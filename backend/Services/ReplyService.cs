using RecruiterReply.Models;

namespace RecruiterReply.Services;

public class ReplyService : IReplyService
{
    private readonly IOpenAIService _openAIService;
    private readonly ILogger<ReplyService> _logger;

    public ReplyService(IOpenAIService openAIService, ILogger<ReplyService> logger)
    {
        _openAIService = openAIService;
        _logger = logger;
    }

    public async Task<GenerateReplyResponse> GenerateReplyAsync(GenerateReplyRequest request)
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
            var reply = await _openAIService.GenerateReplyAsync(
                request.ReplyType,
                request.RecruiterMessage,
                request.CandidateMinimumPay,
                request.PreferredWorkArrangement,
                request.Notes
            );

            return new GenerateReplyResponse
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
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating reply");
            throw;
        }
    }
}
