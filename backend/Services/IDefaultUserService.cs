namespace RecruiterReply.Services;

public interface IDefaultUserService
{
    Task<Guid> GetOrCreateDefaultUserIdAsync(CancellationToken cancellationToken = default);
}
