using Google.Apis.Auth.OAuth2;
using Google.Apis.Auth.OAuth2.Flows;
using Google.Apis.Auth.OAuth2.Requests;
using Google.Apis.Gmail.v1;
using Google.Apis.Services;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.Options;
using RecruiterReply.Entities;
using RecruiterReply.Models;
using RecruiterReply.Repositories;

namespace RecruiterReply.Services;

public class GmailOAuthService : IGmailOAuthService
{
    private const string StateProtectorPurpose = "GmailOAuthState";
    private const string TokenProtectorPurpose = "GmailTokens";
    private static readonly TimeSpan StateMaxAge = TimeSpan.FromMinutes(10);

    private readonly GmailOptions _options;
    private readonly IGmailConnectionRepository _connectionRepository;
    private readonly IDataProtector _stateProtector;
    private readonly IDataProtector _tokenProtector;
    private readonly ILogger<GmailOAuthService> _logger;

    public GmailOAuthService(
        IOptions<GmailOptions> options,
        IGmailConnectionRepository connectionRepository,
        IDataProtectionProvider dataProtectionProvider,
        ILogger<GmailOAuthService> logger)
    {
        _options = options.Value;
        _connectionRepository = connectionRepository;
        _stateProtector = dataProtectionProvider.CreateProtector(StateProtectorPurpose);
        _tokenProtector = dataProtectionProvider.CreateProtector(TokenProtectorPurpose);
        _logger = logger;
    }

    public string BuildAuthorizationUrl(Guid userId)
    {
        var rawState = $"{userId}|{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}";
        var state = _stateProtector.Protect(rawState);

        var request = new GoogleAuthorizationCodeRequestUrl(new Uri("https://accounts.google.com/o/oauth2/v2/auth"))
        {
            ClientId = _options.ClientId,
            RedirectUri = _options.RedirectUri,
            Scope = string.Join(' ', _options.Scopes),
            State = state,
            AccessType = "offline"
        };

        var uri = request.Build();
        // Forces Google to re-issue a refresh token even if the user previously granted consent.
        var separator = uri.Query.Length > 0 ? "&" : "?";
        return $"{uri}{separator}prompt=consent";
    }

    public Guid? TryUnprotectState(string state)
    {
        try
        {
            var rawState = _stateProtector.Unprotect(state);
            var parts = rawState.Split('|', 2);
            if (parts.Length != 2 || !Guid.TryParse(parts[0], out var userId))
            {
                return null;
            }

            if (!long.TryParse(parts[1], out var issuedAtUnixSeconds))
            {
                return null;
            }

            var issuedAt = DateTimeOffset.FromUnixTimeSeconds(issuedAtUnixSeconds);
            if (DateTimeOffset.UtcNow - issuedAt > StateMaxAge)
            {
                _logger.LogWarning("Gmail OAuth state expired for user {UserId}", userId);
                return null;
            }

            return userId;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to unprotect Gmail OAuth state");
            return null;
        }
    }

    public async Task<GmailConnectionEntity> ExchangeCodeForTokensAsync(string code, Guid userId, CancellationToken cancellationToken = default)
    {
        var flow = CreateFlow();
        var tokenResponse = await flow.ExchangeCodeForTokenAsync(userId.ToString(), code, _options.RedirectUri, cancellationToken);

        if (string.IsNullOrWhiteSpace(tokenResponse.RefreshToken))
        {
            throw new InvalidOperationException(
                "Google did not return a refresh token. This connection cannot be used for background sync.");
        }

        var credential = new UserCredential(flow, userId.ToString(), tokenResponse);
        using var gmailService = new GmailService(new BaseClientService.Initializer
        {
            HttpClientInitializer = credential,
            ApplicationName = "RecruiterReply"
        });

        var profile = await gmailService.Users.GetProfile("me").ExecuteAsync(cancellationToken);

        var existing = await _connectionRepository.GetByUserIdAsync(userId, cancellationToken);
        var now = DateTime.UtcNow;

        var connection = existing ?? new GmailConnectionEntity
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            CreatedAt = now
        };

        connection.GoogleAccountEmail = profile.EmailAddress;
        connection.AccessTokenEncrypted = _tokenProtector.Protect(tokenResponse.AccessToken);
        connection.RefreshTokenEncrypted = _tokenProtector.Protect(tokenResponse.RefreshToken);
        connection.TokenExpiresAt = now.AddSeconds(tokenResponse.ExpiresInSeconds ?? 3600);
        connection.GrantedScopes = tokenResponse.Scope ?? string.Join(' ', _options.Scopes);
        connection.Status = "active";
        connection.LastSyncStatus = null;
        connection.LastSyncError = null;
        connection.UpdatedAt = now;

        if (existing is null)
        {
            await _connectionRepository.AddAsync(connection, cancellationToken);
        }
        else
        {
            await _connectionRepository.UpdateAsync(connection, cancellationToken);
        }

        return connection;
    }

    public async Task<string> GetValidAccessTokenAsync(GmailConnectionEntity connection, CancellationToken cancellationToken = default)
    {
        // Small buffer so a token that's about to expire mid-request still gets refreshed.
        if (connection.TokenExpiresAt > DateTime.UtcNow.AddSeconds(60))
        {
            return _tokenProtector.Unprotect(connection.AccessTokenEncrypted);
        }

        var flow = CreateFlow();
        var refreshToken = _tokenProtector.Unprotect(connection.RefreshTokenEncrypted);
        var tokenResponse = await flow.RefreshTokenAsync(connection.UserId.ToString(), refreshToken, cancellationToken);

        connection.AccessTokenEncrypted = _tokenProtector.Protect(tokenResponse.AccessToken);
        // Google often omits refresh_token on a refresh response; the original one stays valid.
        if (!string.IsNullOrWhiteSpace(tokenResponse.RefreshToken))
        {
            connection.RefreshTokenEncrypted = _tokenProtector.Protect(tokenResponse.RefreshToken);
        }

        connection.TokenExpiresAt = DateTime.UtcNow.AddSeconds(tokenResponse.ExpiresInSeconds ?? 3600);
        connection.UpdatedAt = DateTime.UtcNow;
        await _connectionRepository.UpdateAsync(connection, cancellationToken);

        return tokenResponse.AccessToken;
    }

    public async Task DisconnectAsync(GmailConnectionEntity connection, CancellationToken cancellationToken = default)
    {
        var flow = CreateFlow();
        try
        {
            var accessToken = _tokenProtector.Unprotect(connection.AccessTokenEncrypted);
            await flow.RevokeTokenAsync(connection.UserId.ToString(), accessToken, cancellationToken);
        }
        catch (Exception ex)
        {
            // Revocation is best-effort — proceed with the local disconnect either way so the
            // user isn't stuck "connected" in our UI because Google's revoke call hiccuped.
            _logger.LogWarning(ex, "Failed to revoke Gmail token for connection {ConnectionId} during disconnect", connection.Id);
        }

        connection.Status = "disconnected";
        connection.AccessTokenEncrypted = string.Empty;
        connection.RefreshTokenEncrypted = string.Empty;
        connection.UpdatedAt = DateTime.UtcNow;
        await _connectionRepository.UpdateAsync(connection, cancellationToken);
    }

    private GoogleAuthorizationCodeFlow CreateFlow()
    {
        return new GoogleAuthorizationCodeFlow(new GoogleAuthorizationCodeFlow.Initializer
        {
            ClientSecrets = new ClientSecrets
            {
                ClientId = _options.ClientId,
                ClientSecret = _options.ClientSecret
            },
            Scopes = _options.Scopes,
            DataStore = new GmailNullDataStore()
        });
    }
}
