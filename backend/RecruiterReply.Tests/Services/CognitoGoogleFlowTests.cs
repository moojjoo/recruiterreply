using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Options;
using Moq;
using RecruiterReply.Models;
using RecruiterReply.Services;

namespace RecruiterReply.Tests.Services;

public sealed class CognitoGoogleFlowTests
{
    private const string CookieName = "__Host-rr_oauth_state";
    private const string Callback = "https://api-dev.example.test/api/auth/cognito/callback";
    private readonly EphemeralDataProtectionProvider _protection = new();
    private readonly Mock<IHttpClientFactory> _factory = new(MockBehavior.Strict);
    private readonly Clock _clock = new();

    private CognitoBffService CreateService() => new(_factory.Object, _protection,
        Options.Create(new CognitoBffOptions
        {
            Enabled = true, Issuer = "https://issuer.example.test", ResourceIdentifier = "https://api.example.test",
            ClientId = "application-client", ClientSecret = "synthetic-client-secret",
            Domain = "https://application.auth.example.test", RedirectUri = Callback
        }), _clock);

    [Fact]
    public void GoogleStart_PreservesApplicationCallbackPkceNonceAndProtectedCookie()
    {
        var service = CreateService();
        var context = new DefaultHttpContext();
        var url = new Uri(service.BeginLogin(context, "Google"));
        var query = QueryHelpers.ParseQuery(url.Query);
        using var saved = ReadState(context);
        var payload = saved.RootElement;
        Assert.Equal("https://application.auth.example.test/oauth2/authorize", url.GetLeftPart(UriPartial.Path));
        Assert.Equal("Google", query["identity_provider"]);
        Assert.Equal("application-client", query["client_id"]);
        Assert.Equal(Callback, query["redirect_uri"]);
        Assert.Equal("code", query["response_type"]);
        Assert.Equal("S256", query["code_challenge_method"]);
        Assert.Equal(payload.GetProperty("State").GetString(), query["state"]);
        Assert.Equal(payload.GetProperty("Nonce").GetString(), query["nonce"]);
        Assert.Equal(WebEncoders.Base64UrlEncode(SHA256.HashData(Encoding.ASCII.GetBytes(
            payload.GetProperty("Verifier").GetString()!))), query["code_challenge"]);
        Assert.Equal("openid email profile https://api.example.test/read https://api.example.test/write", query["scope"]);
        Assert.False(query.ContainsKey("client_secret"));
        Assert.False(query.ContainsKey("code_verifier"));
        Assert.Equal(JsonValueKind.Null, payload.GetProperty("LinkUserId").ValueKind);
        Assert.False(payload.GetProperty("ReplaceExistingIdentity").GetBoolean());
        var cookie = Assert.Single(context.Response.Headers.SetCookie.ToArray())!;
        Assert.Contains("path=/", cookie);
        Assert.Contains("secure", cookie);
        Assert.Contains("httponly", cookie);
        Assert.Contains("samesite=lax", cookie);
        Assert.Contains("max-age=300", cookie);
        Assert.DoesNotContain("domain=", cookie);
        var next = QueryHelpers.ParseQuery(new Uri(service.BeginLogin(new DefaultHttpContext(), "Google")).Query);
        Assert.NotEqual(query["state"].ToString(), next["state"].ToString());
        Assert.NotEqual(query["nonce"].ToString(), next["nonce"].ToString());
        Assert.NotEqual(query["code_challenge"].ToString(), next["code_challenge"].ToString());
        var email = QueryHelpers.ParseQuery(new Uri(service.BeginLogin(new DefaultHttpContext())).Query);
        Assert.False(email.ContainsKey("identity_provider"));
        Assert.Equal("login", email["prompt"]);
        Assert.Equal(Callback, email["redirect_uri"]);
    }

    [Theory]
    [InlineData("missing-cookie")]
    [InlineData("tampered-cookie")]
    [InlineData("wrong-state")]
    [InlineData("missing-state")]
    [InlineData("missing-code")]
    [InlineData("expired")]
    public async Task GoogleCallback_InvalidTransactionNeverExchangesCode(string failure)
    {
        var service = CreateService();
        var start = new DefaultHttpContext();
        var query = QueryHelpers.ParseQuery(new Uri(service.BeginLogin(start, "Google")).Query);
        var callback = new DefaultHttpContext();
        if (failure != "missing-cookie")
            callback.Request.Headers.Cookie = failure == "tampered-cookie" ? $"{CookieName}=invalid" : CookiePair(start);
        if (failure == "expired") _clock.Now = _clock.Now.AddMinutes(5);
        var state = failure == "wrong-state" ? "wrong" : failure == "missing-state" ? "" : query["state"].ToString();
        await Assert.ThrowsAsync<InvalidOperationException>(() => service.CompleteLoginAsync(callback,
            failure == "missing-code" ? "" : "synthetic-code", state));
        _factory.VerifyNoOtherCalls();
        Assert.Contains($"{CookieName}=;", Assert.Single(callback.Response.Headers.SetCookie.ToArray()));
    }

    [Fact]
    public async Task GoogleCallback_ExchangesCodeWithOriginalVerifierAndApiCallback()
    {
        using var handler = new CaptureExchange();
        using var client = new HttpClient(handler);
        _factory.Setup(factory => factory.CreateClient(It.IsAny<string>())).Returns(client);
        var service = CreateService();
        var start = new DefaultHttpContext();
        var query = QueryHelpers.ParseQuery(new Uri(service.BeginLogin(start, "Google")).Query);
        using var saved = ReadState(start);
        var callback = new DefaultHttpContext();
        callback.Request.Headers.Cookie = CookiePair(start);
        // Stop at a synthetic token rejection: no live metadata or provider traffic.
        var error = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.CompleteLoginAsync(callback, "synthetic-code", query["state"].ToString()));
        Assert.Equal("Cognito token exchange failed.", error.Message);
        Assert.Equal("https://application.auth.example.test/oauth2/token", handler.Url);
        var form = QueryHelpers.ParseQuery(handler.Body!);
        Assert.Equal("authorization_code", form["grant_type"]);
        Assert.Equal("synthetic-code", form["code"]);
        Assert.Equal(Callback, form["redirect_uri"]);
        Assert.Equal("application-client", form["client_id"]);
        Assert.Equal("synthetic-client-secret", form["client_secret"]);
        Assert.Equal(saved.RootElement.GetProperty("Verifier").GetString(), form["code_verifier"]);
        Assert.Contains($"{CookieName}=;", Assert.Single(callback.Response.Headers.SetCookie.ToArray()));
    }

    private static string CookiePair(HttpContext context) => context.Response.Headers.SetCookie.ToString().Split(';')[0];
    private JsonDocument ReadState(HttpContext context) => JsonDocument.Parse(_protection
        .CreateProtector("recruiterreply-cognito-bff-state-v1")
        .Unprotect(Uri.UnescapeDataString(CookiePair(context)[(CookieName.Length + 1)..])));

    private sealed class Clock : TimeProvider
    {
        public DateTimeOffset Now { get; set; } = new(2026, 11, 15, 12, 0, 0, TimeSpan.Zero);
        public override DateTimeOffset GetUtcNow() => Now;
    }

    private sealed class CaptureExchange : HttpMessageHandler
    {
        public string? Url { get; private set; }
        public string? Body { get; private set; }
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Assert.Equal(HttpMethod.Post, request.Method);
            Url = request.RequestUri!.AbsoluteUri;
            Body = await request.Content!.ReadAsStringAsync(cancellationToken);
            return new HttpResponseMessage(HttpStatusCode.BadRequest);
        }
    }
}
