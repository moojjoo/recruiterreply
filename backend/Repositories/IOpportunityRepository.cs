using RecruiterReply.Entities;

namespace RecruiterReply.Repositories;

public interface IOpportunityRepository : IRepository<OpportunityEntity>
{
    Task<List<OpportunityEntity>> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);
}
