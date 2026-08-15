using Google.Apis.Util.Store;

namespace RecruiterReply.Services;

/// <summary>
/// Gmail tokens are persisted ourselves in gmail_connections (encrypted), not via
/// Google.Apis.Util.Store's file-based store, so GoogleAuthorizationCodeFlow gets a no-op.
/// </summary>
public class GmailNullDataStore : IDataStore
{
    public Task StoreAsync<T>(string key, T value) => Task.CompletedTask;
    public Task DeleteAsync<T>(string key) => Task.CompletedTask;
    public Task<T> GetAsync<T>(string key) => Task.FromResult(default(T)!);
    public Task ClearAsync() => Task.CompletedTask;
}
