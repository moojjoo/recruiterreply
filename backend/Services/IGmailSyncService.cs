namespace RecruiterReply.Services;

public interface IGmailSyncService
{
    Task SyncConnectionAsync(Guid connectionId, CancellationToken cancellationToken = default);
}
