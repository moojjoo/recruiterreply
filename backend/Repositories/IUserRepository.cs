using RecruiterReply.Entities;

namespace RecruiterReply.Repositories;

public interface IUserRepository : IRepository<UserEntity>
{
    Task<UserEntity?> GetByEmailAsync(string email, CancellationToken cancellationToken = default);
    Task<UserEntity?> GetByStripeCustomerIdAsync(string stripeCustomerId, CancellationToken cancellationToken = default);
}
