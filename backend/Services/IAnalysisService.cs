using RecruiterReply.Models;

namespace RecruiterReply.Services;

public interface IAnalysisService
{
    Task<AnalyzeMessageResponse> AnalyzeRecruiterMessageAsync(AnalyzeMessageRequest request, Guid userId);
}
