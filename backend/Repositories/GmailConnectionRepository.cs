using Microsoft.EntityFrameworkCore;
using RecruiterReply.Data;
using RecruiterReply.Entities;

namespace RecruiterReply.Repositories;

public class GmailConnectionRepository : EfRepository<GmailConnectionEntity>, IGmailConnectionRepository
{
    public GmailConnectionRepository(RecruiterReplyDbContext dbContext) : base(dbContext)
    {
    }

    public Task<GmailConnectionEntity?> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return DbSet.AsNoTracking()
            .FirstOrDefaultAsync(c => c.UserId == userId, cancellationToken);
    }

    public Task<List<GmailConnectionEntity>> GetActiveConnectionsAsync(CancellationToken cancellationToken = default)
    {
        return DbSet.AsNoTracking()
            .Where(c => c.Status == "active")
            .ToListAsync(cancellationToken);
    }
}
