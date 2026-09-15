using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using RecruiterReply.Controllers;
using RecruiterReply.Entities;
using RecruiterReply.Models;
using RecruiterReply.Repositories;
using RecruiterReply.Services;
using RecruiterReply.Tests.Testing;

namespace RecruiterReply.Tests.Controllers;

public class GmailControllerTests
{
    private readonly Mock<IGmailOAuthService> _oAuthService = new();
    private readonly Mock<IGmailConnectionRepository> _connectionRepository = new();
    private readonly GmailController _sut;
    private readonly Guid _userId = Guid.NewGuid();

    public GmailControllerTests()
    {
        var options = Options.Create(new GmailOptions { FrontendCallbackUrl = "http://localhost:5173/gmail/connected" });
        _sut = new GmailController(_oAuthService.Object, _connectionRepository.Object, options, NullLogger<GmailController>.Instance);
        _sut.SetUser(_userId);
    }

    [Fact]
    public void Connect_ReturnsAuthorizationUrlFromService()
    {
        _oAuthService.Setup(o => o.BuildAuthorizationUrl(_userId)).Returns("https://accounts.google.com/o/oauth2/v2/auth?state=x");

        var result = _sut.Connect();

        Assert.IsType<OkObjectResult>(result);
    }

    [Fact]
    public async Task Callback_WithConsentDenied_RedirectsWithError()
    {
        var result = await _sut.Callback(code: null, state: null, error: "access_denied", CancellationToken.None);

        var redirect = Assert.IsType<RedirectResult>(result);
        Assert.Contains("error=consent_denied", redirect.Url);
    }

    [Fact]
    public async Task Callback_WithMissingCodeOrState_RedirectsWithError()
    {
        var result = await _sut.Callback(code: null, state: null, error: null, CancellationToken.None);

        var redirect = Assert.IsType<RedirectResult>(result);
        Assert.Contains("error=missing_code_or_state", redirect.Url);
    }

    [Fact]
    public async Task Callback_WithInvalidState_RedirectsWithError()
    {
        _oAuthService.Setup(o => o.TryUnprotectState("bad-state")).Returns((Guid?)null);

        var result = await _sut.Callback(code: "code", state: "bad-state", error: null, CancellationToken.None);

        var redirect = Assert.IsType<RedirectResult>(result);
        Assert.Contains("error=invalid_state", redirect.Url);
    }

    [Fact]
    public async Task Callback_OnSuccess_RedirectsWithConnectedTrue()
    {
        _oAuthService.Setup(o => o.TryUnprotectState("good-state")).Returns(_userId);
        _oAuthService.Setup(o => o.ExchangeCodeForTokensAsync("code", _userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new GmailConnectionEntity { Id = Guid.NewGuid() });

        var result = await _sut.Callback(code: "code", state: "good-state", error: null, CancellationToken.None);

        var redirect = Assert.IsType<RedirectResult>(result);
        Assert.Contains("connected=true", redirect.Url);
    }

    [Fact]
    public async Task Callback_WhenExchangeFails_RedirectsWithError()
    {
        _oAuthService.Setup(o => o.TryUnprotectState("good-state")).Returns(_userId);
        _oAuthService.Setup(o => o.ExchangeCodeForTokensAsync("code", _userId, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("no refresh token"));

        var result = await _sut.Callback(code: "code", state: "good-state", error: null, CancellationToken.None);

        var redirect = Assert.IsType<RedirectResult>(result);
        Assert.Contains("error=token_exchange_failed", redirect.Url);
    }

    [Fact]
    public async Task Status_WithNoConnection_ReturnsNotConnected()
    {
        _connectionRepository.Setup(r => r.GetByUserIdAsync(_userId, It.IsAny<CancellationToken>())).ReturnsAsync((GmailConnectionEntity?)null);

        var result = await _sut.Status(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.False(((GmailStatusResponse)ok.Value!).IsConnected);
    }

    [Fact]
    public async Task Status_WithDisconnectedConnection_ReturnsNotConnected()
    {
        _connectionRepository.Setup(r => r.GetByUserIdAsync(_userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new GmailConnectionEntity { Status = "disconnected" });

        var result = await _sut.Status(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.False(((GmailStatusResponse)ok.Value!).IsConnected);
    }

    [Fact]
    public async Task Status_WithActiveConnection_ReturnsConnectedDetails()
    {
        _connectionRepository.Setup(r => r.GetByUserIdAsync(_userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new GmailConnectionEntity { Status = "active", GoogleAccountEmail = "jane@example.com" });

        var result = await _sut.Status(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var status = (GmailStatusResponse)ok.Value!;
        Assert.True(status.IsConnected);
        Assert.Equal("jane@example.com", status.GoogleAccountEmail);
    }

    [Fact]
    public async Task Disconnect_WithNoConnection_ReturnsNotFound()
    {
        _connectionRepository.Setup(r => r.GetByUserIdAsync(_userId, It.IsAny<CancellationToken>())).ReturnsAsync((GmailConnectionEntity?)null);

        var result = await _sut.Disconnect(CancellationToken.None);

        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task Disconnect_WithExistingConnection_CallsOAuthServiceAndReturnsOk()
    {
        var connection = new GmailConnectionEntity { Id = Guid.NewGuid() };
        _connectionRepository.Setup(r => r.GetByUserIdAsync(_userId, It.IsAny<CancellationToken>())).ReturnsAsync(connection);

        var result = await _sut.Disconnect(CancellationToken.None);

        Assert.IsType<OkObjectResult>(result);
        _oAuthService.Verify(o => o.DisconnectAsync(connection, It.IsAny<CancellationToken>()), Times.Once);
    }
}
