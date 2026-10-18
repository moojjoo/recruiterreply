using System.Security.Claims;
using System.Security.Cryptography;
using Amazon.DynamoDBv2;
using Amazon.KeyManagementService;
using Microsoft.AspNetCore.Authentication;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using RecruiterReply.Data;
using RecruiterReply.Services;

#pragma warning disable CS0618 // ASP.NET Core 10.0.12 exposes the legacy AuthenticationHandler constructor.

namespace RecruiterReply.Authentication;

public sealed class BffSessionAuthenticationHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    public const string SchemeName = "BffSession";
    public const string CookieName = "__Host-rr_session";
    private readonly IBffSessionStore _sessions;
    private readonly RecruiterReplyDbContext _db;

    public BffSessionAuthenticationHandler(IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger, System.Text.Encodings.Web.UrlEncoder encoder, ISystemClock clock,
        IBffSessionStore sessions, RecruiterReplyDbContext db)
        : base(options, logger, encoder, clock)
    {
        _sessions = sessions;
        _db = db;
    }

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var rawSessionId = Request.Cookies[CookieName];
        if (string.IsNullOrWhiteSpace(rawSessionId)) return AuthenticateResult.NoResult();

        try
        {
            var session = await _sessions.GetAsync(rawSessionId, Context.RequestAborted);
            var now = DateTimeOffset.UtcNow;
            if (session is null || session.IdleExpiresAt <= now || session.AbsoluteExpiresAt <= now)
                return AuthenticateResult.Fail("BFF session expired.");

            var user = await _db.Users.AsNoTracking().SingleOrDefaultAsync(
                candidate => candidate.Id == session.UserId && candidate.IsActive, Context.RequestAborted);
            if (user is null) return AuthenticateResult.Fail("BFF session user is inactive.");

            var claims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new(ClaimTypes.Email, user.Email),
                new("identity_provider", "cognito"),
                new("cognito_sub", session.ProviderSubject),
                new("cognito_issuer", session.Issuer),
                new("cognito_client_id", session.ClientId),
                new("scope", session.Scopes)
            };
            claims.AddRange(session.Scopes.Split(' ', StringSplitOptions.RemoveEmptyEntries)
                .Select(scope => new Claim("scope", scope)));
            return AuthenticateResult.Success(new AuthenticationTicket(
                new ClaimsPrincipal(new ClaimsIdentity(claims, SchemeName)), SchemeName));
        }
        catch (Exception ex) when (ex is AmazonDynamoDBException or AmazonKeyManagementServiceException or CryptographicException)
        {
            Logger.LogWarning(ex, "BFF session lookup failed");
            return AuthenticateResult.Fail("BFF session is invalid.");
        }
    }
}

#pragma warning restore CS0618
