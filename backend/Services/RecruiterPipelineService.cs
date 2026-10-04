using System.Text.Json;
using RecruiterReply.Entities;
using RecruiterReply.Models;
using RecruiterReply.Repositories;

namespace RecruiterReply.Services;

/// <summary>
/// Phase 1 of the recruiter autopilot: claim → pre-filter → extract (LLM) → evaluate (rules engine)
/// → persist the thread's triage state. Read-only with respect to Gmail; drafts and labels come later.
/// </summary>
public class RecruiterPipelineService : IRecruiterPipelineService
{
    private readonly IRecruiterInboxRepository _repository;
    private readonly IGmailApiClient _apiClient;
    private readonly IOpenAIService _openAIService;
    private readonly IUsageService _usageService;
    private readonly ILogger<RecruiterPipelineService> _logger;

    public RecruiterPipelineService(
        IRecruiterInboxRepository repository,
        IGmailApiClient apiClient,
        IOpenAIService openAIService,
        IUsageService usageService,
        ILogger<RecruiterPipelineService> logger)
    {
        _repository = repository;
        _apiClient = apiClient;
        _openAIService = openAIService;
        _usageService = usageService;
        _logger = logger;
    }

    public async Task ProcessMessageAsync(GmailConnectionEntity connection, string accessToken, string messageId, CancellationToken cancellationToken = default)
    {
        var userId = connection.UserId;
        if (await _repository.EmailExistsAsync(userId, messageId, cancellationToken))
        {
            return;
        }

        var message = await _apiClient.GetMessageFullAsync(accessToken, messageId, cancellationToken);
        var thread = await _repository.GetThreadByGmailIdAsync(userId, message.ThreadId, cancellationToken);
        var email = new RecruiterEmailEntity
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            ThreadId = thread?.Id,
            GmailMessageId = message.MessageId,
            GmailThreadId = message.ThreadId,
            Direction = message.IsSentByUser ? "outbound" : "inbound",
            From = Truncate(message.From, 500),
            Subject = Truncate(message.Subject, 500),
            ReceivedAt = message.ReceivedAt,
            CreatedAt = DateTime.UtcNow,
        };

        // Replies on an already-tracked thread always go through; only new threads need the pre-filter.
        var isFollowUp = thread is not null && !message.IsSentByUser;
        if (!isFollowUp && !RecruiterPrefilter.LooksLikeRecruiterEmail(message, connection.GoogleAccountEmail))
        {
            email.Status = "skipped";
            await _repository.AddEmailAsync(email, cancellationToken);
            return;
        }

        try
        {
            await _usageService.EnsureWithinQuotaAsync(userId, UsageFeatures.AutoTriage, cancellationToken);
        }
        catch (QuotaExceededException)
        {
            email.Status = "quota_exceeded";
            await _repository.AddEmailAsync(email, cancellationToken);
            return;
        }

        RecruiterFacts extracted;
        try
        {
            extracted = await _openAIService.ExtractRecruiterFactsAsync(message.Subject ?? string.Empty, message.From ?? string.Empty, message.Body, cancellationToken);
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Recruiter fact extraction failed for message {MessageId}", messageId);
            email.Status = "error";
            email.Error = ex.Message;
            await _repository.AddEmailAsync(email, cancellationToken);
            return;
        }

        await _usageService.IncrementUsageAsync(userId, UsageFeatures.AutoTriage, cancellationToken);

        if (thread is null && !extracted.IsRecruiter)
        {
            email.Status = "processed";
            await _repository.AddEmailAsync(email, cancellationToken);
            return;
        }

        var now = DateTime.UtcNow;
        if (thread is null)
        {
            thread = new RecruiterThreadEntity
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                GmailThreadId = message.ThreadId,
                Subject = Truncate(message.Subject, 500),
                RecruiterEmail = Truncate(ExtractAddress(message.From), 320),
                CreatedAt = now,
            };
        }

        var previous = string.IsNullOrEmpty(thread.Facts) ? null : JsonSerializer.Deserialize<RecruiterFacts>(thread.Facts);
        var merged = previous?.MergeWith(extracted) ?? extracted;
        var profile = await _repository.GetProfileAsync(userId, cancellationToken);
        var decision = CareerRulesEngine.Evaluate(merged, profile, $"{message.Subject} {message.Body}");

        thread.Facts = JsonSerializer.Serialize(merged);
        thread.State = decision.State;
        thread.MissingFields = JsonSerializer.Serialize(decision.MissingFields);
        thread.Reasons = JsonSerializer.Serialize(decision.Reasons);
        thread.LastMessageAt = message.ReceivedAt;
        thread.UpdatedAt = now;
        await _repository.SaveThreadAsync(thread, cancellationToken);

        email.ThreadId = thread.Id;
        email.Status = "processed";
        await _repository.AddEmailAsync(email, cancellationToken);

        _logger.LogInformation(
            "Triaged recruiter thread {ThreadId} for user {UserId} as {State}",
            thread.Id, userId, decision.State);
    }

    private static string? ExtractAddress(string? from)
    {
        if (string.IsNullOrWhiteSpace(from))
        {
            return null;
        }

        var start = from.IndexOf('<');
        var end = from.IndexOf('>');
        return start >= 0 && end > start ? from[(start + 1)..end].Trim() : from.Trim();
    }

    private static string? Truncate(string? value, int max) =>
        value is null || value.Length <= max ? value : value[..max];
}
