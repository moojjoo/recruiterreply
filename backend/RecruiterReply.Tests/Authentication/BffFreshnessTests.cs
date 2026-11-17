using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using RecruiterReply.Authentication;
using RecruiterReply.Entities;
using RecruiterReply.Services;
using RecruiterReply.Tests.Testing;

namespace RecruiterReply.Tests.Authentication;

#pragma warning disable CS0618
public sealed class BffFreshnessTests
{
    [Theory]
    [InlineData(null)]
    [InlineData(-3600)]
    [InlineData(-60)]
    [InlineData(60)]
    public async Task OrdinarySessionWorksButOnlyOriginalNonfutureAuthTimeIsEmitted(int? seconds)
    {
        await using var db = TestDb.Create();
        var now = DateTimeOffset.UtcNow;
        var userId = Guid.NewGuid();
        db.Users.Add(new UserEntity { Id = userId, Email = "test@example.com", PasswordHash = "", IsActive = true });
        db.UserIdentities.Add(new UserIdentityEntity
        {
            Id = Guid.NewGuid(), UserId = userId, Provider = "cognito", Subject = "subject", Email = "test@example.com"
        });
        await db.SaveChangesAsync();
        var original = seconds is null ? (DateTimeOffset?)null : now.AddSeconds(seconds.Value);
        var session = new BffSession(userId, "subject", "https://issuer.test", "client", "read",
            now, now, now.AddMinutes(30), now.AddHours(8), "synthetic", null, original);
        var store = new Mock<IBffSessionStore>();
        store.Setup(s => s.GetAsync("session", It.IsAny<CancellationToken>())).ReturnsAsync(session);
        var options = new Mock<IOptionsMonitor<AuthenticationSchemeOptions>>();
        options.Setup(o => o.Get(It.IsAny<string>())).Returns(new AuthenticationSchemeOptions());
        var handler = new BffSessionAuthenticationHandler(options.Object, NullLoggerFactory.Instance,
            UrlEncoder.Default, new SystemClock(), store.Object, db);
        var context = new DefaultHttpContext();
        context.Request.Headers.Cookie = "__Host-rr_session=session";
        await handler.InitializeAsync(new AuthenticationScheme("BffSession", null, typeof(BffSessionAuthenticationHandler)), context);

        var result = await handler.AuthenticateAsync();

        Assert.True(result.Succeeded);
        Assert.Equal("https://issuer.test", result.Principal!.FindFirst("cognito_issuer")?.Value);
        Assert.Equal(seconds is null || seconds > 0 ? null : original!.Value.ToUnixTimeSeconds().ToString(),
            result.Principal.FindFirst("auth_time")?.Value);
    }
}
#pragma warning restore CS0618
