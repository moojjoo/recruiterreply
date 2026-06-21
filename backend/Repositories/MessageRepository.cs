using Microsoft.EntityFrameworkCore;
using RecruiterReply.Data;
using RecruiterReply.Entities;

namespace RecruiterReply.Repositories;

public class MessageRepository : EfRepository<MessageEntity>, IMessageRepository
{
    public MessageRepository(RecruiterReplyDbContext dbContext) : base(dbContext)
    {
    }

    public Task<List<MessageEntity>> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return DbSet.AsNoTracking()
            .Where(m => m.UserId == userId)
            .OrderByDescending(m => m.CreatedAt)
            .ToListAsync(cancellationToken);
    }
}
