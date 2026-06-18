using RecruiterReply.Models;
using System.Text.Json;

namespace RecruiterReply.Services;

public class AnalysisService : IAnalysisService
{
    private readonly IOpenAIService _openAIService;
    private readonly ILogger<AnalysisService> _logger;

    public AnalysisService(IOpenAIService openAIService, ILogger<AnalysisService> logger)
    {
        _openAIService = openAIService;
        _logger = logger;
    }

    public async Task<AnalyzeMessageResponse> AnalyzeRecruiterMessageAsync(AnalyzeMessageRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.RecruiterMessage))
        {
            throw new ArgumentException("Recruiter message cannot be empty");
        }

        try
        {
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

            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error analyzing recruiter message");
            throw;
        }
    }
}
