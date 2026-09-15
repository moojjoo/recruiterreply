using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using RecruiterReply.Models;
using RecruiterReply.Repositories;
using RecruiterReply.Services;

namespace RecruiterReply.Tests.Services;

public class GmailOAuthServiceTests
{
    private readonly Mock<IGmailConnectionRepository> _connectionRepository = new();
    private readonly GmailOAuthService _sut;

    public GmailOAuthServiceTests()
    {
        var options = new GmailOptions
        {
            ClientId = "test-client-id",
            RedirectUri = "http://localhost:5002/api/gmail/callback",
            Scopes = ["https://www.googleapis.com/auth/gmail.readonly"],
        };

        _sut = new GmailOAuthService(
            Options.Create(options),
            _connectionRepository.Object,
            new EphemeralDataProtectionProvider(),
            NullLogger<GmailOAuthService>.Instance);
    }

    [Fact]
    public void BuildAuthorizationUrl_IncludesClientIdScopeAndForcedConsentPrompt()
    {
        var userId = Guid.NewGuid();

        var url = _sut.BuildAuthorizationUrl(userId);

        Assert.StartsWith("https://accounts.google.com/o/oauth2/v2/auth?", url);
        Assert.Contains("client_id=test-client-id", url);
        Assert.Contains("prompt=consent", url);
    }

    [Fact]
    public void BuildAuthorizationUrl_ThenTryUnprotectState_RoundTripsToOriginalUserId()
    {
        var userId = Guid.NewGuid();
        var url = _sut.BuildAuthorizationUrl(userId);
        var state = Uri.UnescapeDataString(url.Split("state=")[1].Split('&')[0]);

        var result = _sut.TryUnprotectState(state);

        Assert.Equal(userId, result);
    }

    [Fact]
    public void TryUnprotectState_WithGarbageInput_ReturnsNull()
    {
        var result = _sut.TryUnprotectState("not-a-real-protected-payload");

        Assert.Null(result);
    }

    [Fact]
    public void TryUnprotectState_WithTamperedState_ReturnsNull()
    {
        var url = _sut.BuildAuthorizationUrl(Guid.NewGuid());
        var state = Uri.UnescapeDataString(url.Split("state=")[1].Split('&')[0]);
        var tampered = state[..^1] + (state[^1] == 'A' ? 'B' : 'A');

        var result = _sut.TryUnprotectState(tampered);

        Assert.Null(result);
    }
}
