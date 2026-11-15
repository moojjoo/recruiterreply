using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using RecruiterReply.Controllers;
using RecruiterReply.Entities;
using RecruiterReply.Services;
using RecruiterReply.Tests.Testing;

namespace RecruiterReply.Tests.Controllers;

public sealed class CognitoGoogleCallbackTests
{
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Callback_CreatesOrReusesIdentityAndKeepsTokensServerSide(bool returning)
    {
        await using var db = TestDb.Create();
        var cognito = new Mock<ICognitoBffService>();
        var sessions = new Mock<IBffSessionStore>(MockBehavior.Strict);
        var tokens = new CognitoTokenSet("synthetic-access", "synthetic-refresh", "api/read",
            new CognitoIdentity("google-federated-subject", "google@example.test", "Test", "User"));
        cognito.Setup(service => service.CompleteLoginAsync(It.IsAny<HttpContext>(), "code", "state", It.IsAny<CancellationToken>()))
            .ReturnsAsync(tokens);
        BffSession? saved = null;
        sessions.Setup(store => store.CreateAsync(It.IsAny<BffSession>(), It.IsAny<CancellationToken>()))
            .Callback<BffSession, CancellationToken>((session, _) => saved = session).ReturnsAsync("opaque-session-id");
        var controller = CreateController(db, cognito.Object, sessions.Object);
        var first = await controller.CognitoCallback("code", "state", CancellationToken.None);
        var userId = Assert.Single(db.Users).Id;
        if (returning)
        {
            controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };
            first = await controller.CognitoCallback("code", "state", CancellationToken.None);
        }
        Assert.Equal("https://dev.example.test/dashboard", Assert.IsType<RedirectResult>(first).Url);
        Assert.Equal(userId, Assert.Single(db.Users).Id);
        Assert.Equal(userId, Assert.Single(db.UserIdentities).UserId);
        Assert.NotNull(saved);
        Assert.Equal("synthetic-access", saved.AccessToken);
        Assert.Equal("synthetic-refresh", saved.RefreshToken);
        var cookie = Assert.Single(controller.Response.Headers.SetCookie.ToArray())!;
        Assert.Contains("opaque-session-id", cookie);
        Assert.Contains("httponly", cookie);
        Assert.Contains("secure", cookie);
        Assert.Contains("samesite=lax", cookie);
        Assert.Contains("path=/", cookie);
        Assert.DoesNotContain("domain=", cookie);
        Assert.DoesNotContain("synthetic-access", cookie);
        Assert.DoesNotContain("synthetic-refresh", cookie);
    }

    [Theory]
    [InlineData("same-email")]
    [InlineData("inactive")]
    [InlineData("invalid-callback")]
    public async Task Callback_RejectsUnsafeLoginWithoutSessionOrAccountMutation(string scenario)
    {
        await using var db = TestDb.Create();
        var user = new UserEntity
        {
            Id = Guid.NewGuid(), Email = "google@example.test", PasswordHash = "existing-hash",
            AuthProvider = scenario == "inactive" ? "cognito" : "local",
            ProviderUserId = scenario == "inactive" ? "subject" : null,
            IsActive = scenario != "inactive", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();
        var cognito = new Mock<ICognitoBffService>();
        var setup = cognito.Setup(service => service.CompleteLoginAsync(It.IsAny<HttpContext>(), "code", "state", It.IsAny<CancellationToken>()));
        if (scenario == "invalid-callback") setup.ThrowsAsync(new InvalidOperationException("synthetic internal detail"));
        else setup.ReturnsAsync(new CognitoTokenSet("access", "refresh", "api/read",
            new CognitoIdentity("subject", user.Email, null, null)));
        var sessions = new Mock<IBffSessionStore>(MockBehavior.Strict);
        var controller = CreateController(db, cognito.Object, sessions.Object);
        var result = await controller.CognitoCallback("code", "state", CancellationToken.None);
        Assert.Equal("https://dev.example.test/login?error=cognito_auth_failed", Assert.IsType<RedirectResult>(result).Url);
        Assert.Equal(user.Id, Assert.Single(db.Users).Id);
        Assert.Equal("existing-hash", user.PasswordHash);
        Assert.Empty(db.UserIdentities);
        Assert.Equal(0, controller.Response.Headers.SetCookie.Count);
        sessions.VerifyNoOtherCalls();
    }

    private static AuthController CreateController(RecruiterReply.Data.RecruiterReplyDbContext db,
        ICognitoBffService cognito, IBffSessionStore sessions)
    {
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Jwt:Key"] = "synthetic-signing-key-at-least-32-characters",
            ["Frontend:BaseUrl"] = "https://dev.example.test",
            ["CognitoBff:Issuer"] = "https://issuer.example.test",
            ["CognitoBff:ClientId"] = "application-client"
        }).Build();
        return new AuthController(db, new PasswordHashService(), new JwtTokenService(config),
            Mock.Of<IGoogleAuthService>(), config, NullLogger<AuthController>.Instance,
            cognitoBff: cognito, bffSessions: sessions)
        { ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() } };
    }
}
