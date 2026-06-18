namespace RecruiterReply.Services;

public interface IOpenAIService
{
    Task<string> AnalyzeRecruiterMessageAsync(string message, string? companyName, string? jobTitle);
    Task<string> GenerateReplyAsync(string replyType, string message, decimal? minPay, string? workArrangement, string? notes);
    Task<string> CompareOffersAsync(string offerOneJson, string offerTwoJson);
}
