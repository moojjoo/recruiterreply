using RecruiterReply.Entities;

namespace RecruiterReply.Repositories;

public interface IRecruiterInboxRepository
{
    Task<bool> EmailExistsAsync(Guid userId, string gmailMessageId, CancellationToken cancellationToken = default);
    Task AddEmailAsync(RecruiterEmailEntity email, CancellationToken cancellationToken = default);
    Task<RecruiterThreadEntity?> GetThreadByGmailIdAsync(Guid userId, string gmailThreadId, CancellationToken cancellationToken = default);
    Task<RecruiterThreadEntity?> GetThreadAsync(Guid userId, Guid threadId, CancellationToken cancellationToken = default);
    Task<List<RecruiterThreadEntity>> ListThreadsAsync(Guid userId, string? state, CancellationToken cancellationToken = default);
    Task SaveThreadAsync(RecruiterThreadEntity thread, CancellationToken cancellationToken = default);
    Task<CareerProfileEntity?> GetProfileAsync(Guid userId, CancellationToken cancellationToken = default);
    Task SaveProfileAsync(CareerProfileEntity profile, CancellationToken cancellationToken = default);
}
