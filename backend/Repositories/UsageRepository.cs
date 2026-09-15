using Microsoft.EntityFrameworkCore;
using RecruiterReply.Data;
using RecruiterReply.Entities;

namespace RecruiterReply.Repositories;

public class UsageRepository : EfRepository<UsageRecordEntity>, IUsageRepository
{
    public UsageRepository(RecruiterReplyDbContext dbContext) : base(dbContext)
    {
    }

    public Task<UsageRecordEntity?> GetForPeriodAsync(Guid userId, string feature, DateTime periodStart, CancellationToken cancellationToken = default)
    {
        return DbSet.FirstOrDefaultAsync(
            u => u.UserId == userId && u.Feature == feature && u.PeriodStart == periodStart,
            cancellationToken);
    }

    public Task<List<UsageRecordEntity>> GetForPeriodAsync(Guid userId, DateTime periodStart, CancellationToken cancellationToken = default)
    {
        return DbSet.AsNoTracking()
            .Where(u => u.UserId == userId && u.PeriodStart == periodStart)
            .ToListAsync(cancellationToken);
    }
}
