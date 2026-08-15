using RecruiterReply.Entities;

namespace RecruiterReply.Repositories;

public interface IGmailConnectionRepository : IRepository<GmailConnectionEntity>
{
    Task<GmailConnectionEntity?> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<List<GmailConnectionEntity>> GetActiveConnectionsAsync(CancellationToken cancellationToken = default);
}
