using RecruiterReply.Models;

namespace RecruiterReply.Services;

public interface IReplyService
{
    Task<GenerateReplyResponse> GenerateReplyAsync(GenerateReplyRequest request, Guid userId);
}
