using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.EntityFrameworkCore;
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
            new CognitoIdentity("subject", user.Email, null, null), user.Id));
        var controller = CreateController(db, cognito);
        controller.SetUser(user.Id);
        controller.HttpContext.User = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim("auth_time", DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString())
        }, "TestAuth"));

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
            "access", "refresh", "api/read", new CognitoIdentity(subject, user.Email, "Existing", "User"), user.Id));
        controller.SetUser(user.Id);

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
            "access", "refresh", "api/read", new CognitoIdentity("already-linked", target.Email, null, null), target.Id));
        controller.SetUser(target.Id);

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
            "access", "refresh", "api/read", new CognitoIdentity("new-subject", user.Email, null, null),
            user.Id, ReplaceExistingIdentity: true));
        controller.SetUser(user.Id);

        var result = await controller.CognitoCallback("code", "state", CancellationToken.None);

        Assert.Equal("https://dev.example.test/dashboard", Assert.IsType<RedirectResult>(result).Url);
        var identity = Assert.Single(db.UserIdentities);
        Assert.Equal("new-subject", identity.Subject);
    }

    [Fact]
    public async Task CognitoCallback_DisplacedLegacySubjectCannotReattach()
    {
        await using var db = TestDb.Create();
        var user = NewCognitoUser();
        db.Users.Add(user);
        db.UserIdentities.Add(NewIdentity(user, "new-subject"));
        await db.SaveChangesAsync();
        var sessions = new FakeSessionStore();
        var controller = CreateController(db, new FakeCognitoBff(new CognitoTokenSet(
            "access", null, "api/read", new CognitoIdentity("old-subject", user.Email, null, null))), sessions);

        var result = await controller.CognitoCallback("code", "state", CancellationToken.None);

        Assert.Equal("https://dev.example.test/login?error=cognito_auth_failed", Assert.IsType<RedirectResult>(result).Url);
        Assert.Equal("new-subject", Assert.Single(db.UserIdentities).Subject);
        Assert.Equal(0, sessions.CreatedCount);
        Assert.Single(db.Users);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task CognitoCallback_ReplacementPreservesAccountAndUpdatesLegacyPointer(bool hasMapping)
    {
        await using var db = TestDb.Create();
        var user = NewCognitoUser();
        var originalId = user.Id;
        db.Users.Add(user);
        if (hasMapping) db.UserIdentities.Add(NewIdentity(user, "old-subject"));
        await db.SaveChangesAsync();
        var controller = CreateController(db, new CognitoTokenSet(
            "access", null, "api/read", new CognitoIdentity("new-subject", user.Email, null, null),
            user.Id, ReplaceExistingIdentity: true));
        controller.SetUser(user.Id);

        var result = await controller.CognitoCallback("code", "state", CancellationToken.None);

        Assert.Equal("https://dev.example.test/dashboard", Assert.IsType<RedirectResult>(result).Url);
        Assert.Equal("new-subject", Assert.Single(db.UserIdentities).Subject);
        Assert.Equal("new-subject", user.ProviderUserId);
        Assert.Equal(originalId, Assert.Single(db.Users).Id);
        Assert.Equal("existing@example.com", user.Email);
        Assert.Equal("unchanged-password", user.PasswordHash);
        Assert.Equal("customer-test", user.StripeCustomerId);
        Assert.Equal("subscription-test", user.StripeSubscriptionId);
        Assert.Equal("professional", user.SubscriptionTier);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task CognitoCallback_ReplacementRequiresIntentIncludingLegacyOnly(bool hasMapping)
    {
        await using var db = TestDb.Create();
        var user = NewCognitoUser();
        db.Users.Add(user);
        if (hasMapping) db.UserIdentities.Add(NewIdentity(user, "old-subject"));
        await db.SaveChangesAsync();
        var sessions = new FakeSessionStore();
        var controller = CreateController(db, new FakeCognitoBff(new CognitoTokenSet(
            "access", null, "api/read", new CognitoIdentity("new-subject", user.Email, null, null), user.Id)), sessions);
        controller.SetUser(user.Id);

        var result = await controller.CognitoCallback("code", "state", CancellationToken.None);

        Assert.Equal("https://dev.example.test/profile?error=cognito_link_failed", Assert.IsType<RedirectResult>(result).Url);
        Assert.Equal("old-subject", user.ProviderUserId);
        Assert.Equal(hasMapping ? 1 : 0, db.UserIdentities.Count());
        Assert.Equal(0, sessions.CreatedCount);
    }

    [Fact]
    public async Task CognitoCallback_LegacyOnlyLoginStillCreatesCanonicalMapping()
    {
        await using var db = TestDb.Create();
        var user = NewCognitoUser();
        db.Users.Add(user);
        await db.SaveChangesAsync();
        var controller = CreateController(db, new CognitoTokenSet(
            "access", null, "api/read", new CognitoIdentity("old-subject", user.Email, null, null)));

        var result = await controller.CognitoCallback("code", "state", CancellationToken.None);

        Assert.Equal("https://dev.example.test/dashboard", Assert.IsType<RedirectResult>(result).Url);
        Assert.Equal(user.Id, Assert.Single(db.UserIdentities).UserId);
        Assert.Single(db.Users);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task CognitoCallback_ReplacementRejectsOtherOwnersWithoutIssuingSession(bool canonicalOwner)
    {
        await using var db = TestDb.Create();
        var target = NewCognitoUser();
        var owner = NewCognitoUser();
        owner.Email = "other@example.com";
        owner.ProviderUserId = "owned-subject";
        db.Users.AddRange(target, owner);
        db.UserIdentities.Add(NewIdentity(target, "old-subject"));
        if (canonicalOwner) db.UserIdentities.Add(NewIdentity(owner, "owned-subject"));
        await db.SaveChangesAsync();
        var sessions = new FakeSessionStore();
        var controller = CreateController(db, new FakeCognitoBff(new CognitoTokenSet(
            "access", null, "api/read", new CognitoIdentity("owned-subject", owner.Email, null, null),
            target.Id, ReplaceExistingIdentity: true)), sessions);
        controller.SetUser(target.Id);

        var result = await controller.CognitoCallback("code", "state", CancellationToken.None);

        Assert.Equal("https://dev.example.test/profile?error=cognito_link_failed", Assert.IsType<RedirectResult>(result).Url);
        Assert.Equal("old-subject", target.ProviderUserId);
        Assert.Equal("old-subject", db.UserIdentities.Single(i => i.UserId == target.Id).Subject);
        Assert.Equal(0, sessions.CreatedCount);
        Assert.Equal(2, db.Users.Count());
    }

    [Fact]
    public async Task CognitoCallback_DatabaseWriteConflictCannotIssueSession()
    {
        var options = new DbContextOptionsBuilder<RecruiterReplyDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
        await using var db = new FailingWriteDb(options);
        var user = NewCognitoUser();
        db.Users.Add(user);
        db.UserIdentities.Add(NewIdentity(user, "old-subject"));
        await db.SaveChangesAsync();
        db.FailWrites = true;
        var sessions = new FakeSessionStore();
        var controller = CreateController(db, new FakeCognitoBff(new CognitoTokenSet(
            "access", null, "api/read", new CognitoIdentity("new-subject", user.Email, null, null),
            user.Id, ReplaceExistingIdentity: true)), sessions);
        controller.SetUser(user.Id);

        await Assert.ThrowsAsync<DbUpdateException>(() => controller.CognitoCallback("code", "state", CancellationToken.None));

        Assert.Equal(0, sessions.CreatedCount);
        Assert.False(controller.Response.Headers.ContainsKey("Set-Cookie"));
        db.ChangeTracker.Clear();
        Assert.Equal("old-subject", db.Users.Single().ProviderUserId);
        Assert.Equal("old-subject", db.UserIdentities.Single().Subject);
    }

    private sealed class FailingWriteDb(DbContextOptions<RecruiterReplyDbContext> options)
        : RecruiterReplyDbContext(options)
    {
        public bool FailWrites { get; set; }
        public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
            => FailWrites ? throw new DbUpdateException("Simulated unique-constraint conflict")
                : base.SaveChangesAsync(cancellationToken);
    }

    private static UserEntity NewCognitoUser() => new()
    {
        Id = Guid.NewGuid(), Email = "existing@example.com", PasswordHash = "unchanged-password",
        AuthProvider = "cognito", ProviderUserId = "old-subject", IsActive = true,
        StripeCustomerId = "customer-test", StripeSubscriptionId = "subscription-test",
        SubscriptionTier = "professional", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow
    };

    private static UserIdentityEntity NewIdentity(UserEntity user, string subject) => new()
    {
        Id = Guid.NewGuid(), UserId = user.Id, Provider = "cognito", Subject = subject,
        Email = user.Email, CreatedAt = DateTime.UtcNow, LastUsedAt = DateTime.UtcNow
    };

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
        public int CreatedCount { get; private set; }
        public Task<string> CreateAsync(BffSession session, CancellationToken cancellationToken = default)
        { CreatedCount++; return Task.FromResult("session-id"); }
        public Task<BffSession?> GetAsync(string sessionId, CancellationToken cancellationToken = default) => Task.FromResult<BffSession?>(null);
        public Task RevokeAsync(string sessionId, CancellationToken cancellationToken = default) => Task.CompletedTask;
    }
}
