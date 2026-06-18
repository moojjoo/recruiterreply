using RecruiterReply.Models;
using System.Text.Json;
using RecruiterReply.Data;
using RecruiterReply.Entities;

namespace RecruiterReply.Services;

public class AnalysisService : IAnalysisService
{
    private readonly IOpenAIService _openAIService;
    private readonly ILogger<AnalysisService> _logger;
    private readonly RecruiterReplyDbContext _dbContext;

    public AnalysisService(
        IOpenAIService openAIService,
        ILogger<AnalysisService> logger,
        RecruiterReplyDbContext dbContext)
    {
        _openAIService = openAIService;
        _logger = logger;
        _dbContext = dbContext;
    }

    public async Task<AnalyzeMessageResponse> AnalyzeRecruiterMessageAsync(AnalyzeMessageRequest request, Guid userId)
    {
        if (string.IsNullOrWhiteSpace(request.RecruiterMessage))
        {
            throw new ArgumentException("Recruiter message cannot be empty");
        }

        try
        {
            var message = new MessageEntity
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Subject = request.JobTitle,
                Body = request.RecruiterMessage,
                CompanyName = request.CompanyName,
                CreatedAt = DateTime.UtcNow
            };

            _dbContext.Messages.Add(message);
            await _dbContext.SaveChangesAsync();

            var result = await _openAIService.AnalyzeRecruiterMessageAsync(
                request.RecruiterMessage,
                request.CompanyName,
                request.JobTitle
            );

            var response = JsonSerializer.Deserialize<AnalyzeMessageResponse>(result);
            if (response == null)
            {
                throw new InvalidOperationException("Failed to deserialize AI response");
            }

            var compensationJson = JsonSerializer.Serialize(new
            {
                compensationMentioned = response.CompensationMentioned,
                jobType = response.JobType,
                opportunityScore = response.OpportunityScore
            });

            var analysis = new MessageAnalysisEntity
            {
                Id = Guid.NewGuid(),
                MessageId = message.Id,
                UserId = userId,
                CompetitivenessScore = Math.Clamp(response.OpportunityScore / 10, 1, 10),
                CompensationEvaluation = compensationJson,
                RedFlags = JsonSerializer.Serialize(response.RedFlags),
                AnalysisSummary = response.SuggestedResponse,
                SuggestedTone = "Professional",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _dbContext.MessageAnalyses.Add(analysis);
            await _dbContext.SaveChangesAsync();

            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error analyzing recruiter message");
            throw;
        }
    }
}
