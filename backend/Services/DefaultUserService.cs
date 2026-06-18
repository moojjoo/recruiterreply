using Microsoft.EntityFrameworkCore;
using RecruiterReply.Data;
using RecruiterReply.Entities;

namespace RecruiterReply.Services;

public class DefaultUserService : IDefaultUserService
{
    private const string DefaultEmail = "local@recruiterreply.dev";
    private readonly RecruiterReplyDbContext _dbContext;

    public DefaultUserService(RecruiterReplyDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<Guid> GetOrCreateDefaultUserIdAsync(CancellationToken cancellationToken = default)
    {
        var existing = await _dbContext.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Email == DefaultEmail, cancellationToken);

        if (existing != null)
        {
            return existing.Id;
        }

        var now = DateTime.UtcNow;
        var user = new UserEntity
        {
            Id = Guid.NewGuid(),
            Email = DefaultEmail,
            PasswordHash = "local-dev-placeholder",
            FirstName = "Local",
            LastName = "User",
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };

        _dbContext.Users.Add(user);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return user.Id;
    }
}
