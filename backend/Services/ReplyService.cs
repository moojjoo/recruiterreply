using RecruiterReply.Models;
using RecruiterReply.Data;
using RecruiterReply.Entities;

namespace RecruiterReply.Services;

public class ReplyService : IReplyService
{
    private readonly IOpenAIService _openAIService;
    private readonly ILogger<ReplyService> _logger;
    private readonly RecruiterReplyDbContext _dbContext;

    public ReplyService(
        IOpenAIService openAIService,
        ILogger<ReplyService> logger,
        RecruiterReplyDbContext dbContext)
    {
        _openAIService = openAIService;
        _logger = logger;
        _dbContext = dbContext;
    }

    public async Task<GenerateReplyResponse> GenerateReplyAsync(GenerateReplyRequest request, Guid userId)
    {
        if (string.IsNullOrWhiteSpace(request.RecruiterMessage))
        {
            throw new ArgumentException("Recruiter message cannot be empty");
        }

        if (string.IsNullOrWhiteSpace(request.ReplyType))
        {
            throw new ArgumentException("Reply type cannot be empty");
        }

        try
        {
            var message = new MessageEntity
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Subject = $"reply-{request.ReplyType}",
                Body = request.RecruiterMessage,
                CompanyName = "Unknown",
                CreatedAt = DateTime.UtcNow
            };

            _dbContext.Messages.Add(message);
            await _dbContext.SaveChangesAsync();

            var analysis = new MessageAnalysisEntity
            {
                Id = Guid.NewGuid(),
                MessageId = message.Id,
                UserId = userId,
                CompetitivenessScore = 5,
                CompensationEvaluation = "{}",
                RedFlags = "[]",
                AnalysisSummary = "Reply generation request",
                SuggestedTone = request.ReplyType,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _dbContext.MessageAnalyses.Add(analysis);
            await _dbContext.SaveChangesAsync();

            var reply = await _openAIService.GenerateReplyAsync(
                request.ReplyType,
                request.RecruiterMessage,
                request.CandidateMinimumPay,
                request.PreferredWorkArrangement,
                request.Notes
            );

            var response = new GenerateReplyResponse
            {
                Reply = reply,
                Tone = request.ReplyType switch
                {
                    "interested" => "Enthusiastic",
                    "request_pay_range" => "Professional",
                    "counteroffer" => "Confident",
                    "decline" => "Polite",
                    "followup" => "Proactive",
                    _ => "Professional"
                }
            };

            var generatedReply = new GeneratedReplyEntity
            {
                Id = Guid.NewGuid(),
                AnalysisId = analysis.Id,
                UserId = userId,
                ReplyType = request.ReplyType,
                Content = response.Reply,
                Tone = response.Tone,
                IsUsed = false,
                CreatedAt = DateTime.UtcNow
            };

            _dbContext.GeneratedReplies.Add(generatedReply);
            await _dbContext.SaveChangesAsync();

            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating reply");
            throw;
        }
    }
}
