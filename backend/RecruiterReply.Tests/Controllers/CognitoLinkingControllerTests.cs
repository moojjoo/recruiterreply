using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using RecruiterReply.Controllers;
using RecruiterReply.Data;
using RecruiterReply.Entities;
using RecruiterReply.Models;
using RecruiterReply.Services;
using RecruiterReply.Tests.Testing;

namespace RecruiterReply.Tests.Controllers;

public sealed class CognitoLinkingControllerTests
{
    [Fact]
    public async Task CognitoLinkStartRequiresAuthenticatedUserAndBindsTargetUser()
    {
        await using var db = TestDb.Create();
        var user = new UserEntity
        {
            Id = Guid.NewGuid(), Email = "existing@example.com", PasswordHash = "hash",
            IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();
        var cognito = new FakeCognitoBff(new CognitoTokenSet("access", null, "api/read",
            VerifiedIdentity("subject", user.Email, null, null), user.Id));
        var controller = CreateController(db, cognito);
        SetRecentUser(controller, user.Id);
        controller.HttpContext.User = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim("auth_time", DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString()),
            new Claim("cognito_issuer", "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test")
        }, "BffSession"));

        var result = controller.CognitoLinkStart();

        Assert.Equal(200, Assert.IsType<OkObjectResult>(result).StatusCode);
        Assert.Equal(user.Id, cognito.LastLinkUserId);
        Assert.Equal("Google", cognito.LastProvider);
    }

    [Fact]
    public async Task CognitoCallback_LinkFlowAssociatesIdentityWithAuthenticatedUser()
    {
        await using var db = TestDb.Create();
        var user = new UserEntity
        {
            Id = Guid.NewGuid(), Email = "existing@example.com", PasswordHash = "hash",
            IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var subject = "cognito-subject";
        var controller = CreateController(db, new CognitoTokenSet(
            "access", "refresh", "api/read", VerifiedIdentity(subject, user.Email, "Existing", "User"), user.Id));
        SetRecentUser(controller, user.Id);

        var result = await controller.CognitoCallback("code", "state", CancellationToken.None);

        Assert.Equal("https://dev.example.test/dashboard", Assert.IsType<RedirectResult>(result).Url);
        var identity = Assert.Single(db.UserIdentities);
        Assert.Equal(user.Id, identity.UserId);
        Assert.Equal(subject, identity.Subject);
        Assert.Equal("cognito", identity.Provider);
    }

    [Fact]
    public async Task CognitoCallback_LinkFlowRejectsIdentityOwnedByAnotherUser()
    {
        await using var db = TestDb.Create();
        var target = new UserEntity
        {
            Id = Guid.NewGuid(), Email = "target@example.com", PasswordHash = "hash",
            IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow
        };
        var owner = new UserEntity
        {
            Id = Guid.NewGuid(), Email = "owner@example.com", PasswordHash = "hash",
            IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow
        };
        db.Users.AddRange(target, owner);
        db.UserIdentities.Add(new UserIdentityEntity
        {
            Id = Guid.NewGuid(), UserId = owner.Id, Provider = "cognito", Subject = "already-linked",
            Email = owner.Email, CreatedAt = DateTime.UtcNow, LastUsedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var controller = CreateController(db, new CognitoTokenSet(
            "access", "refresh", "api/read", VerifiedIdentity("already-linked", target.Email, null, null), target.Id));
        SetRecentUser(controller, target.Id);

        var result = await controller.CognitoCallback("code", "state", CancellationToken.None);

        Assert.Equal("https://dev.example.test/profile?error=cognito_link_failed", Assert.IsType<RedirectResult>(result).Url);
        Assert.Single(db.UserIdentities);
        Assert.Equal(owner.Id, db.UserIdentities.Single().UserId);
    }

    [Fact]
    public async Task CognitoCallback_LinkFlowReplacesExistingIdentityOnlyWithExplicitIntent()
    {
        await using var db = TestDb.Create();
        var user = new UserEntity
        {
            Id = Guid.NewGuid(), Email = "existing@example.com", PasswordHash = "hash",
            IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow
        };
        db.Users.Add(user);
        db.UserIdentities.Add(new UserIdentityEntity
        {
            Id = Guid.NewGuid(), UserId = user.Id, Provider = "cognito", Subject = "old-subject",
            Email = user.Email, CreatedAt = DateTime.UtcNow, LastUsedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var controller = CreateController(db, new CognitoTokenSet(
            "access", "refresh", "api/read", VerifiedIdentity("new-subject", user.Email, null, null),
            user.Id, ReplaceExistingIdentity: true));
        SetRecentUser(controller, user.Id);

        var result = await controller.CognitoCallback("code", "state", CancellationToken.None);

        Assert.Equal("https://dev.example.test/dashboard", Assert.IsType<RedirectResult>(result).Url);
        var identity = Assert.Single(db.UserIdentities);
        Assert.Equal("new-subject", identity.Subject);
    }

    [Theory]
    [InlineData(null, "BffSession", "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test")]
    [InlineData("stale", "BffSession", "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test")]
    [InlineData("future", "BffSession", "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test")]
    [InlineData("recent", "EdgeSession", "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test")]
    [InlineData("recent", "BffSession", "https://other.example.test")]
    public async Task LinkingRejectsUntrustedOrStaleAuthentication(string? age, string scheme, string issuer)
    {
        await using var db = TestDb.Create();
        var userId = Guid.NewGuid();
        db.Users.Add(new UserEntity { Id = userId, Email = "existing@example.com", PasswordHash = "unchanged", IsActive = true });
        await db.SaveChangesAsync();
        var fake = new FakeCognitoBff(new CognitoTokenSet("access", null, "api/read",
            VerifiedIdentity("subject", "existing@example.com", null, null), userId));
        var controller = CreateController(db, fake);
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, userId.ToString()), new("cognito_issuer", issuer)
        };
        if (age is not null)
            claims.Add(new Claim("auth_time", DateTimeOffset.UtcNow.AddMinutes(
                age == "stale" ? -16 : age == "future" ? 5 : 0).ToUnixTimeSeconds().ToString()));
        controller.HttpContext.User = new ClaimsPrincipal(new ClaimsIdentity(claims, scheme));

        Assert.Equal(401, Assert.IsType<ObjectResult>(controller.CognitoLinkStart()).StatusCode);
        Assert.Null(fake.LastLinkUserId);
        var result = await controller.CognitoCallback("code", "state", CancellationToken.None);
        Assert.Equal("https://dev.example.test/profile?error=cognito_link_failed", Assert.IsType<RedirectResult>(result).Url);
        Assert.Empty(db.UserIdentities);
        Assert.Equal(userId, Assert.Single(db.Users).Id);
    }

    [Theory]
    [InlineData("missing")]
    [InlineData("stale")]
    [InlineData("wrong-issuer")]
    public async Task LinkCompletionRequiresIncomingVerifiedFreshIdentity(string failure)
    {
        await using var db = TestDb.Create();
        var userId = Guid.NewGuid();
        db.Users.Add(new UserEntity { Id = userId, Email = "test@example.com", PasswordHash = "unchanged", IsActive = true });
        await db.SaveChangesAsync();
        var identity = VerifiedIdentity("subject", "test@example.com", null, null) with
        {
            Issuer = failure == "wrong-issuer" ? "https://wrong.example.test" :
                "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test",
            AuthenticatedAt = failure == "missing" ? null :
                DateTimeOffset.UtcNow.AddMinutes(failure == "stale" ? -16 : 0)
        };
        var controller = CreateController(db, new CognitoTokenSet("access", null, "api/read", identity, userId));
        SetRecentUser(controller, userId);

        var result = await controller.CognitoCallback("code", "state", CancellationToken.None);

        Assert.Equal("https://dev.example.test/profile?error=cognito_link_failed", Assert.IsType<RedirectResult>(result).Url);
        Assert.Equal(userId, Assert.Single(db.Users).Id);
        Assert.Empty(db.UserIdentities);
        Assert.False(controller.Response.Headers.ContainsKey("Set-Cookie"));
    }

    [Fact]
    public async Task OrdinaryLoginStoresOriginalSignedTimeRatherThanIssuanceTime()
    {
        await using var db = TestDb.Create();
        var original = DateTimeOffset.UtcNow.AddHours(-1);
        var identity = VerifiedIdentity("new-subject", "test@example.com", null, null) with
            { AuthenticatedAt = original };
        var sessions = new FakeSessionStore();
        var controller = CreateController(db, new FakeCognitoBff(new CognitoTokenSet(
            "access", null, "api/read", identity)), sessions);

        var result = await controller.CognitoCallback("code", "state", CancellationToken.None);

        Assert.Equal("https://dev.example.test/dashboard", Assert.IsType<RedirectResult>(result).Url);
        Assert.NotNull(sessions.CreatedSession);
        Assert.Equal(original, sessions.CreatedSession.AuthenticatedAt);
        Assert.Equal(identity.Issuer, sessions.CreatedSession.Issuer);
        Assert.True(sessions.CreatedSession.CreatedAt > original);
    }

    private static CognitoIdentity VerifiedIdentity(string subject, string email, string? first, string? last)
        => new(subject, email, first, last, "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test",
            DateTimeOffset.UtcNow);

    private static void SetRecentUser(AuthController controller, Guid userId)
    {
        controller.SetUser(userId);
        controller.HttpContext.User = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
            new Claim("auth_time", DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString()),
            new Claim("cognito_issuer", "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test")
        }, "BffSession"));
    }

    private static AuthController CreateController(RecruiterReplyDbContext db, CognitoTokenSet tokens)
        => CreateController(db, new FakeCognitoBff(tokens));

    private static AuthController CreateController(RecruiterReplyDbContext db, FakeCognitoBff cognito, FakeSessionStore? sessionStore = null)
    {
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Jwt:Key"] = "a-sufficiently-long-test-signing-key-1234567890",
            ["Frontend:BaseUrl"] = "https://dev.example.test",
            ["CognitoBff:Issuer"] = "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test",
            ["CognitoBff:ClientId"] = "client-id"
        }).Build();
        var google = new Mock<IGoogleAuthService>();
        var sessions = sessionStore ?? new FakeSessionStore();
        return new AuthController(db, new PasswordHashService(), new JwtTokenService(config), google.Object,
            config, NullLogger<AuthController>.Instance, cognitoBff: cognito, bffSessions: sessions)
        { ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() } };
    }

    private sealed class FakeCognitoBff(CognitoTokenSet tokens) : ICognitoBffService
    {
        public Guid? LastLinkUserId { get; private set; }
        public string? LastProvider { get; private set; }

        public string BeginLogin(HttpContext context, string? identityProvider = null, Guid? linkUserId = null,
            bool replaceExistingIdentity = false)
        {
            LastProvider = identityProvider;
            LastLinkUserId = linkUserId;
            return "https://cognito.example.test";
        }

        public Task<CognitoTokenSet> CompleteLoginAsync(HttpContext context, string code, string state, CancellationToken cancellationToken = default)
            => Task.FromResult(tokens);
    }

    private sealed class FakeSessionStore : IBffSessionStore
    {
        public BffSession? CreatedSession { get; private set; }
        public Task<string> CreateAsync(BffSession session, CancellationToken cancellationToken = default)
        { CreatedSession = session; return Task.FromResult("session-id"); }
        public Task<BffSession?> GetAsync(string sessionId, CancellationToken cancellationToken = default) => Task.FromResult<BffSession?>(null);
        public Task RevokeAsync(string sessionId, CancellationToken cancellationToken = default) => Task.CompletedTask;
    }
}
