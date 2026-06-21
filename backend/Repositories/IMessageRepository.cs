using RecruiterReply.Entities;

namespace RecruiterReply.Repositories;

public interface IMessageRepository : IRepository<MessageEntity>
{
    Task<List<MessageEntity>> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);
}
