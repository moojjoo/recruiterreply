using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using Moq;
using RecruiterReply.Models;
using RecruiterReply.Services;
using System.Net;
using System.Text.Json;

namespace RecruiterReply.Tests.Services;

public sealed class CognitoBffServiceTests
{
    [Fact]
    public void BeginLogin_UsesRootPathForHostPrefixedStateCookie()
    {
        var factory = new Mock<IHttpClientFactory>();
        var options = Options.Create(new CognitoBffOptions
        {
            Enabled = true,
            Issuer = "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test",
            ResourceIdentifier = "https://api.dev.example.test",
            ClientId = "client-id",
            ClientSecret = "client-secret",
            Domain = "https://example.auth.us-east-1.amazoncognito.com",
            RedirectUri = "https://dev.example.test/api/auth/cognito/callback",
        });
        var dataProtection = DataProtectionProvider.Create("recruiterreply-cognito-bff-tests");
        var sut = new CognitoBffService(factory.Object, dataProtection, options);
        var context = new DefaultHttpContext();

        sut.BeginLogin(context);

        var setCookie = Assert.Single(context.Response.Headers.SetCookie.ToArray());
        Assert.Contains("__Host-rr_oauth_state=", setCookie);
        Assert.Contains("path=/", setCookie, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("path=/api/auth/cognito", setCookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("secure", setCookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("httponly", setCookie, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void BeginLogin_WithProvider_AddsIdentityProviderWithoutChangingCallbackContract()
    {
        var factory = new Mock<IHttpClientFactory>();
        var options = Options.Create(new CognitoBffOptions
        {
            Enabled = true,
            Issuer = "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test",
            ResourceIdentifier = "https://api.dev.example.test",
            ClientId = "client-id",
            ClientSecret = "client-secret",
            Domain = "https://example.auth.us-east-1.amazoncognito.com",
            RedirectUri = "https://dev.example.test/api/auth/cognito/callback",
        });
        var dataProtection = DataProtectionProvider.Create("recruiterreply-cognito-bff-provider-tests");
        var sut = new CognitoBffService(factory.Object, dataProtection, options);

        var authorizationUrl = sut.BeginLogin(new DefaultHttpContext(), "Google");
        var query = Microsoft.AspNetCore.WebUtilities.QueryHelpers.ParseQuery(new Uri(authorizationUrl).Query);

        Assert.Equal("Google", query["identity_provider"]);
        Assert.False(query.ContainsKey("prompt"));
        Assert.Equal("https://dev.example.test/api/auth/cognito/callback", query["redirect_uri"]);
        Assert.Equal("code", query["response_type"]);
    }

    [Fact]
    public void BeginLogin_WithoutProvider_ForcesInteractiveNativeLogin()
    {
        var factory = new Mock<IHttpClientFactory>();
        var options = Options.Create(new CognitoBffOptions
        {
            Enabled = true,
            Issuer = "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test",
            ResourceIdentifier = "https://api.dev.example.test",
            ClientId = "client-id",
            ClientSecret = "client-secret",
            Domain = "https://example.auth.us-east-1.amazoncognito.com",
            RedirectUri = "https://dev.example.test/api/auth/cognito/callback",
        });
        var sut = new CognitoBffService(factory.Object,
            DataProtectionProvider.Create("recruiterreply-cognito-bff-email-tests"), options);

        var first = Microsoft.AspNetCore.WebUtilities.QueryHelpers.ParseQuery(
            new Uri(sut.BeginLogin(new DefaultHttpContext())).Query);
        var repeated = Microsoft.AspNetCore.WebUtilities.QueryHelpers.ParseQuery(
            new Uri(sut.BeginLogin(new DefaultHttpContext())).Query);

        Assert.Equal("login", first["prompt"]);
        Assert.False(first.ContainsKey("identity_provider"));
        Assert.NotEqual(first["state"].ToString(), repeated["state"].ToString());
        Assert.NotEqual(first["nonce"].ToString(), repeated["nonce"].ToString());
        Assert.NotEqual(first["code_challenge"].ToString(), repeated["code_challenge"].ToString());
    }

    [Fact]
    public void CognitoTokenResponse_MapsOAuthSnakeCaseFields()
    {
        var response = JsonSerializer.Deserialize<CognitoBffService.CognitoTokenResponse>(
            "{\"access_token\":\"access\",\"refresh_token\":\"refresh\",\"id_token\":\"identity\",\"scope\":\"openid api/read\"}");

        Assert.NotNull(response);
        Assert.Equal("access", response!.AccessToken);
        Assert.Equal("refresh", response.RefreshToken);
        Assert.Equal("identity", response.IdToken);
        Assert.Equal("openid api/read", response.Scope);
    }

    [Fact]
    public void NativeEndpoint_DefaultOff_PreservesNativeGoogleAndLinkRoutes()
    {
        var options = CreateOptions();
        options.Value.NativeDomain = "https://app-auth-dev.recruiterreply.com";
        options.Value.NativeDomainVerifiedUserPoolId = "us-east-1_synthetic";
        var sut = CreateService(options);

        Assert.Equal("example.auth.us-east-1.amazoncognito.com", new Uri(sut.BeginLogin(new DefaultHttpContext())).Host);
        Assert.Equal("example.auth.us-east-1.amazoncognito.com", new Uri(sut.BeginLogin(new DefaultHttpContext(), "Google")).Host);
        Assert.Equal("example.auth.us-east-1.amazoncognito.com", new Uri(sut.BeginLogin(new DefaultHttpContext(), null, Guid.NewGuid())).Host);
    }

    [Fact]
    public void NativeEndpoint_Enabled_RoutesOnlyUnlinkedNativeLoginToPinnedDevOrigin()
    {
        var options = ApprovedNativeOptions();
        var sut = CreateService(options);

        Assert.Equal("app-auth-dev.recruiterreply.com", new Uri(sut.BeginLogin(new DefaultHttpContext())).Host);
        Assert.Equal("example.auth.us-east-1.amazoncognito.com", new Uri(sut.BeginLogin(new DefaultHttpContext(), "Google")).Host);
        Assert.Equal("example.auth.us-east-1.amazoncognito.com", new Uri(sut.BeginLogin(new DefaultHttpContext(), null, Guid.NewGuid())).Host);
    }

    [Theory]
    [InlineData("https://other.auth.us-east-1.amazoncognito.com", "us-east-1_synthetic", "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_synthetic")]
    [InlineData("https://app-auth-dev.recruiterreply.com", "us-east-1_other", "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_synthetic")]
    [InlineData("https://app-auth-dev.recruiterreply.com", "us-east-1_synthetic", "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_other")]
    [InlineData("http://app-auth-dev.recruiterreply.com", "us-east-1_synthetic", "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_synthetic")]
    [InlineData("https://user@app-auth-dev.recruiterreply.com", "us-east-1_synthetic", "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_synthetic")]
    public void NativeEndpoint_RejectsAnythingExceptExactOriginAndIndependentlyAttestedPool(
        string domain, string attestedPool, string issuer)
    {
        var options = ApprovedNativeOptions();
        options.Value.NativeDomain = domain;
        options.Value.NativeDomainVerifiedUserPoolId = attestedPool;
        options.Value.Issuer = issuer;
        var factory = new Mock<IHttpClientFactory>();
        var sut = CreateService(options, factory.Object);

        Assert.Throws<InvalidOperationException>(() => sut.BeginLogin(new DefaultHttpContext()));
        factory.Verify(candidate => candidate.CreateClient(It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task NativeCallback_UsesEndpointBoundIntoProtectedTransaction()
    {
        Uri? exchangeUri = null;
        var factory = new Mock<IHttpClientFactory>();
        factory.Setup(candidate => candidate.CreateClient(It.IsAny<string>())).Returns(new HttpClient(
            new DelegateHandler(request => { exchangeUri = request.RequestUri; return new(HttpStatusCode.BadRequest); })));
        var options = ApprovedNativeOptions();
        var sut = CreateService(options, factory.Object);
        var start = new DefaultHttpContext();
        var authorization = new Uri(sut.BeginLogin(start));
        var state = Microsoft.AspNetCore.WebUtilities.QueryHelpers.ParseQuery(authorization.Query)["state"].ToString();
        var callback = CallbackWithStateCookie(start);

        await Assert.ThrowsAsync<InvalidOperationException>(() => sut.CompleteLoginAsync(callback, "synthetic-code", state));

        Assert.Equal("https://app-auth-dev.recruiterreply.com/oauth2/token", exchangeUri?.ToString());
    }

    [Fact]
    public async Task NativeCallback_ConfigDriftFailsBeforeHttpClientOrSecretExchange()
    {
        var factory = new Mock<IHttpClientFactory>();
        var options = ApprovedNativeOptions();
        var sut = CreateService(options, factory.Object);
        var start = new DefaultHttpContext();
        var authorization = new Uri(sut.BeginLogin(start));
        var state = Microsoft.AspNetCore.WebUtilities.QueryHelpers.ParseQuery(authorization.Query)["state"].ToString();
        options.Value.NativeEndpointEnabled = false;

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            sut.CompleteLoginAsync(CallbackWithStateCookie(start), "synthetic-code", state));
        factory.Verify(candidate => candidate.CreateClient(It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public void NativeFreshness_AcceptsAuthenticationInSameUnixSecond()
    {
        var transactionStartedAt = DateTimeOffset.FromUnixTimeMilliseconds(1_800_000_000_900);
        var authenticatedAt = DateTimeOffset.FromUnixTimeSeconds(transactionStartedAt.ToUnixTimeSeconds());

        Assert.True(CognitoBffService.IsAuthenticationAtOrAfterTransaction(authenticatedAt, transactionStartedAt));
    }

    [Fact]
    public void NativeFreshness_RejectsAuthenticationFromPrecedingUnixSecond()
    {
        var transactionStartedAt = DateTimeOffset.FromUnixTimeMilliseconds(1_800_000_000_100);
        var authenticatedAt = DateTimeOffset.FromUnixTimeSeconds(transactionStartedAt.ToUnixTimeSeconds() - 1);

        Assert.False(CognitoBffService.IsAuthenticationAtOrAfterTransaction(authenticatedAt, transactionStartedAt));
    }

    private static IOptions<CognitoBffOptions> CreateOptions() => Options.Create(new CognitoBffOptions
    {
        Enabled = true,
        Issuer = "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_synthetic",
        ResourceIdentifier = "https://api.dev.example.test",
        ClientId = "client-id",
        ClientSecret = "client-secret",
        Domain = "https://example.auth.us-east-1.amazoncognito.com",
        RedirectUri = "https://dev.example.test/api/auth/cognito/callback",
    });

    private static IOptions<CognitoBffOptions> ApprovedNativeOptions()
    {
        var options = CreateOptions();
        options.Value.NativeEndpointEnabled = true;
        options.Value.NativeDomain = "https://app-auth-dev.recruiterreply.com";
        options.Value.NativeDomainVerifiedUserPoolId = "us-east-1_synthetic";
        return options;
    }

    private static CognitoBffService CreateService(IOptions<CognitoBffOptions> options,
        IHttpClientFactory? factory = null) => new(factory ?? Mock.Of<IHttpClientFactory>(),
        DataProtectionProvider.Create("recruiterreply-native-endpoint-tests"), options);

    private static DefaultHttpContext CallbackWithStateCookie(DefaultHttpContext start)
    {
        var callback = new DefaultHttpContext();
        callback.Request.Headers.Cookie = Assert.Single(start.Response.Headers.SetCookie.ToArray())!.Split(';')[0];
        return callback;
    }

    private sealed class DelegateHandler(Func<HttpRequestMessage, HttpResponseMessage> response) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,
            CancellationToken cancellationToken) => Task.FromResult(response(request));
    }
}
