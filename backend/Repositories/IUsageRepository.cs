using RecruiterReply.Entities;

namespace RecruiterReply.Repositories;

public interface IUsageRepository : IRepository<UsageRecordEntity>
{
    Task<UsageRecordEntity?> GetForPeriodAsync(Guid userId, string feature, DateTime periodStart, CancellationToken cancellationToken = default);
    Task<List<UsageRecordEntity>> GetForPeriodAsync(Guid userId, DateTime periodStart, CancellationToken cancellationToken = default);
}
