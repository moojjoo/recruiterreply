using Microsoft.EntityFrameworkCore;
using RecruiterReply.Data;
using RecruiterReply.Entities;

namespace RecruiterReply.Repositories;

public class OpportunityRepository : EfRepository<OpportunityEntity>, IOpportunityRepository
{
    public OpportunityRepository(RecruiterReplyDbContext dbContext) : base(dbContext)
    {
    }

    public Task<List<OpportunityEntity>> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return DbSet.AsNoTracking()
            .Where(o => o.UserId == userId)
            .OrderByDescending(o => o.CreatedAt)
            .ToListAsync(cancellationToken);
    }
}
