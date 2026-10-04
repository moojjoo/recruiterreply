using RecruiterReply.Entities;

namespace RecruiterReply.Services;

public interface IRecruiterPipelineService
{
    Task ProcessMessageAsync(GmailConnectionEntity connection, string accessToken, string messageId, CancellationToken cancellationToken = default);
}
