using RecruiterReply.Entities;

namespace RecruiterReply.Services;

public interface IGmailOAuthService
{
    /// <summary>Builds the Google consent screen URL, with the RecruiterReply user id embedded in a signed state param.</summary>
    string BuildAuthorizationUrl(Guid userId);

    /// <summary>Verifies and decodes the state param from a callback request. Returns null if invalid/tampered.</summary>
    Guid? TryUnprotectState(string state);

    /// <summary>Exchanges an OAuth code for tokens, resolves the connected Gmail address, and upserts the connection.</summary>
    Task<GmailConnectionEntity> ExchangeCodeForTokensAsync(string code, Guid userId, CancellationToken cancellationToken = default);

    /// <summary>Returns a valid (refreshed if necessary) plaintext access token for the given connection.</summary>
    Task<string> GetValidAccessTokenAsync(GmailConnectionEntity connection, CancellationToken cancellationToken = default);

    /// <summary>Revokes the connection's tokens with Google and soft-disconnects it (status set to disconnected, tokens cleared).</summary>
    Task DisconnectAsync(GmailConnectionEntity connection, CancellationToken cancellationToken = default);
}
