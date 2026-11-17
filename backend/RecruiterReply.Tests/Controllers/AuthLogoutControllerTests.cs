using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using RecruiterReply.Authentication;
using RecruiterReply.Controllers;
using RecruiterReply.Services;
using RecruiterReply.Tests.Testing;

namespace RecruiterReply.Tests.Controllers;

public sealed class AuthLogoutControllerTests
{
    [Fact]
    public async Task Logout_RevokesApplicationSessionWithoutClearingPerimeterCookie()
    {
        var sessions = new Mock<IBffSessionStore>(MockBehavior.Strict);
        sessions.Setup(store => store.RevokeAsync("application-session", It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        var controller = CreateController(sessions.Object);
        controller.HttpContext.Request.Headers.Cookie =
            $"{BffSessionAuthenticationHandler.CookieName}=application-session; rr_session=perimeter-session";

        var result = await controller.Logout(CancellationToken.None);

        Assert.IsType<NoContentResult>(result);
        sessions.Verify(store => store.RevokeAsync("application-session", It.IsAny<CancellationToken>()), Times.Once);
        var setCookies = controller.HttpContext.Response.Headers.SetCookie.ToArray();
        var applicationCookie = Assert.Single(setCookies)!;
        Assert.StartsWith("__Host-rr_session=", applicationCookie, StringComparison.Ordinal);
        Assert.Contains("expires=", applicationCookie, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(setCookies, cookie => cookie!.StartsWith("rr_session=", StringComparison.Ordinal));
    }

    [Fact]
    public async Task Logout_WithoutApplicationSession_IsIdempotentAndPreservesPerimeterCookie()
    {
        var sessions = new Mock<IBffSessionStore>(MockBehavior.Strict);
        var controller = CreateController(sessions.Object);
        controller.HttpContext.Request.Headers.Cookie = "rr_session=perimeter-session";

        var result = await controller.Logout(CancellationToken.None);

        Assert.IsType<NoContentResult>(result);
        sessions.VerifyNoOtherCalls();
        var setCookies = controller.HttpContext.Response.Headers.SetCookie.ToArray();
        Assert.Single(setCookies);
        Assert.DoesNotContain(setCookies, cookie => cookie!.StartsWith("rr_session=", StringComparison.Ordinal));
    }

    private static AuthController CreateController(IBffSessionStore sessions)
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Jwt:Key"] = "a-sufficiently-long-test-signing-key-1234567890",
            ["Frontend:BaseUrl"] = "https://dev.recruiterreply.com"
        }).Build();
        var controller = new AuthController(
            TestDb.Create(),
            new PasswordHashService(),
            new JwtTokenService(configuration),
            Mock.Of<IGoogleAuthService>(),
            configuration,
            NullLogger<AuthController>.Instance,
            bffSessions: sessions);
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };
        return controller;
    }
}
