using System.Text.Json;
using RecruiterReply.Entities;
using RecruiterReply.Models;

namespace RecruiterReply.Services;

public class RecruiterActionService : IRecruiterActionService
{
    private const string ParentLabel = "RecruiterReply";

    internal static readonly IReadOnlyDictionary<string, string> StateLabels = new Dictionary<string, string>
    {
        [TriageStates.Qualified] = $"{ParentLabel}/Qualified",
        [TriageStates.NeedsInfo] = $"{ParentLabel}/Needs info",
        [TriageStates.BelowBar] = $"{ParentLabel}/Below bar",
    };

    private readonly IGmailApiClient _apiClient;
    private readonly IOpenAIService _openAIService;
    private readonly ILogger<RecruiterActionService> _logger;

    public RecruiterActionService(IGmailApiClient apiClient, IOpenAIService openAIService, ILogger<RecruiterActionService> logger)
    {
        _apiClient = apiClient;
        _openAIService = openAIService;
        _logger = logger;
    }

    public async Task ApplyAsync(
        GmailConnectionEntity connection,
        string accessToken,
        RecruiterThreadEntity thread,
        GmailMessageDetail message,
        TriageDecision decision,
        RecruiterFacts facts,
        CareerProfileEntity? profile,
        CancellationToken cancellationToken = default)
    {
        if (!GmailScopes.CanWrite(connection.GrantedScopes) || profile?.Paused == true)
        {
            return;
        }

        // Gmail write failures must not undo triage — the inbox in the app still works without them.
        try
        {
            await ApplyLabelAsync(connection, accessToken, thread.GmailThreadId, decision.State, cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "Failed to label Gmail thread {ThreadId}", thread.Id);
            // A user may have deleted one of our labels; re-resolve ids next time.
            connection.LabelIds = null;
        }

        if (message.IsSentByUser || !StateLabels.ContainsKey(decision.State))
        {
            return;
        }

        try
        {
            await DraftReplyAsync(accessToken, thread, message, decision, facts, profile, cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "Failed to draft reply for thread {ThreadId}", thread.Id);
        }
    }

    private async Task ApplyLabelAsync(GmailConnectionEntity connection, string accessToken, string gmailThreadId, string state, CancellationToken cancellationToken)
    {
        var labelIds = await ResolveLabelIdsAsync(connection, accessToken, cancellationToken);
        var add = StateLabels.TryGetValue(state, out var name) ? [labelIds[name]] : new List<string>();
        var remove = labelIds.Where(kv => kv.Key != name && kv.Key != ParentLabel).Select(kv => kv.Value).ToList();
        await _apiClient.ModifyThreadLabelsAsync(accessToken, gmailThreadId, add, remove, cancellationToken);
    }

    private async Task<Dictionary<string, string>> ResolveLabelIdsAsync(GmailConnectionEntity connection, string accessToken, CancellationToken cancellationToken)
    {
        var cached = string.IsNullOrEmpty(connection.LabelIds)
            ? null
            : JsonSerializer.Deserialize<Dictionary<string, string>>(connection.LabelIds);
        if (cached is not null && StateLabels.Values.All(cached.ContainsKey))
        {
            return cached;
        }

        // Parent first so Gmail nests the state labels under it.
        var labelIds = new Dictionary<string, string>
        {
            [ParentLabel] = await _apiClient.EnsureLabelAsync(accessToken, ParentLabel, cancellationToken),
        };
        foreach (var name in StateLabels.Values)
        {
            labelIds[name] = await _apiClient.EnsureLabelAsync(accessToken, name, cancellationToken);
        }

        connection.LabelIds = JsonSerializer.Serialize(labelIds);
        return labelIds;
    }

    private async Task DraftReplyAsync(
        string accessToken,
        RecruiterThreadEntity thread,
        GmailMessageDetail message,
        TriageDecision decision,
        RecruiterFacts facts,
        CareerProfileEntity? profile,
        CancellationToken cancellationToken)
    {
        var to = message.ReplyTo ?? message.From;
        if (string.IsNullOrWhiteSpace(to))
        {
            return;
        }

        var body = await _openAIService.GenerateTriageReplyAsync(new TriageReplyContext(
            decision.State,
            decision.MissingFields,
            decision.Reasons,
            profile,
            facts.RecruiterName,
            message.Subject ?? string.Empty,
            message.Body), cancellationToken);

        // Only one suggested reply per thread: replace the previous one if the user hasn't used it.
        if (!string.IsNullOrEmpty(thread.DraftId))
        {
            await _apiClient.DeleteDraftAsync(accessToken, thread.DraftId, cancellationToken);
        }

        thread.DraftId = await _apiClient.CreateDraftReplyAsync(accessToken, new GmailDraftReply(
            message.ThreadId,
            to,
            message.Subject ?? string.Empty,
            message.RfcMessageId,
            message.References,
            body), cancellationToken);
        thread.DraftCreatedAt = DateTime.UtcNow;
    }
}
