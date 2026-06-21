using Microsoft.EntityFrameworkCore;
using RecruiterReply.Data;
using RecruiterReply.Entities;

namespace RecruiterReply.Repositories;

public class UserRepository : EfRepository<UserEntity>, IUserRepository
{
    public UserRepository(RecruiterReplyDbContext dbContext) : base(dbContext)
    {
    }

    public Task<UserEntity?> GetByEmailAsync(string email, CancellationToken cancellationToken = default)
    {
        return DbSet.FirstOrDefaultAsync(u => u.Email == email, cancellationToken);
    }
}
