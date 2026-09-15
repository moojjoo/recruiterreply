using System.Net;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using RecruiterReply.Entities;
using RecruiterReply.Services;
using RecruiterReply.Tests.Testing;

namespace RecruiterReply.Tests.Services;

public class GoogleAuthServiceTests
{
    private static IConfiguration BuildConfig(Dictionary<string, string?>? values = null)
    {
        var defaults = new Dictionary<string, string?>
        {
            ["Google:ClientId"] = "test-client-id",
            ["Google:ClientSecret"] = "test-client-secret",
            ["Google:RedirectUri"] = "http://localhost:5002/api/auth/google/callback",
        };
        foreach (var (key, value) in values ?? [])
        {
            defaults[key] = value;
        }

        return new ConfigurationBuilder().AddInMemoryCollection(defaults).Build();
    }

    private static (GoogleAuthService sut, RecruiterReply.Data.RecruiterReplyDbContext db) CreateSut(
        IConfiguration? config,
        Func<HttpRequestMessage, HttpResponseMessage> responder)
    {
        var db = TestDb.Create();
        var handler = new FakeHttpMessageHandler(responder);
        var httpClientFactory = new Mock<IHttpClientFactory>();
        httpClientFactory.Setup(f => f.CreateClient(It.IsAny<string>())).Returns(new HttpClient(handler));

        var sut = new GoogleAuthService(config ?? BuildConfig(), db, new JwtTokenService(BuildJwtConfig()), httpClientFactory.Object);
        return (sut, db);
    }

    private static IConfiguration BuildJwtConfig() =>
        new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Jwt:Key"] = "a-sufficiently-long-test-signing-key-1234567890",
        }).Build();

    // ----- BuildAuthorizationUrl -----

    [Fact]
    public void BuildAuthorizationUrl_WithoutClientId_Throws()
    {
        var (sut, _) = CreateSut(BuildConfig(new Dictionary<string, string?> { ["Google:ClientId"] = null }), _ => new HttpResponseMessage());

        Assert.Throws<InvalidOperationException>(() => sut.BuildAuthorizationUrl());
    }

    [Fact]
    public void BuildAuthorizationUrl_WithClientId_BuildsExpectedQueryString()
    {
        var (sut, _) = CreateSut(null, _ => new HttpResponseMessage());

        var url = sut.BuildAuthorizationUrl();

        Assert.StartsWith("https://accounts.google.com/o/oauth2/v2/auth?", url);
        Assert.Contains("client_id=test-client-id", url);
        Assert.Contains("response_type=code", url);
        Assert.Contains("scope=openid%20email%20profile", url);
    }

    // ----- ExchangeCodeForTokenAsync -----

    private static HttpResponseMessage JsonResponse(HttpStatusCode status, string json) =>
        new(status) { Content = new StringContent(json, System.Text.Encoding.UTF8, "application/json") };

    [Fact]
    public async Task ExchangeCodeForTokenAsync_WhenTokenExchangeFails_Throws()
    {
        var (sut, _) = CreateSut(null, _ => JsonResponse(HttpStatusCode.BadRequest, "{\"error\":\"invalid_grant\"}"));

        await Assert.ThrowsAsync<InvalidOperationException>(() => sut.ExchangeCodeForTokenAsync("bad-code"));
    }

    [Fact]
    public async Task ExchangeCodeForTokenAsync_WhenAccessTokenMissing_Throws()
    {
        var (sut, _) = CreateSut(null, _ => JsonResponse(HttpStatusCode.OK, "{}"));

        await Assert.ThrowsAsync<InvalidOperationException>(() => sut.ExchangeCodeForTokenAsync("code"));
    }

    [Fact]
    public async Task ExchangeCodeForTokenAsync_WhenProfileFetchFails_Throws()
    {
        var (sut, _) = CreateSut(null, req => req.RequestUri!.Host == "oauth2.googleapis.com"
            ? JsonResponse(HttpStatusCode.OK, "{\"access_token\":\"tok\"}")
            : JsonResponse(HttpStatusCode.Forbidden, "{\"error\":\"forbidden\"}"));

        await Assert.ThrowsAsync<InvalidOperationException>(() => sut.ExchangeCodeForTokenAsync("code"));
    }

    [Fact]
    public async Task ExchangeCodeForTokenAsync_WhenEmailOrSubMissing_Throws()
    {
        var (sut, _) = CreateSut(null, req => req.RequestUri!.Host == "oauth2.googleapis.com"
            ? JsonResponse(HttpStatusCode.OK, "{\"access_token\":\"tok\"}")
            : JsonResponse(HttpStatusCode.OK, "{\"given_name\":\"Jane\"}"));

        await Assert.ThrowsAsync<InvalidOperationException>(() => sut.ExchangeCodeForTokenAsync("code"));
    }

    [Fact]
    public async Task ExchangeCodeForTokenAsync_WithNewUser_CreatesUserAndReturnsToken()
    {
        var (sut, db) = CreateSut(null, req => req.RequestUri!.Host == "oauth2.googleapis.com"
            ? JsonResponse(HttpStatusCode.OK, "{\"access_token\":\"tok\"}")
            : JsonResponse(HttpStatusCode.OK, """{"email":"new@example.com","given_name":"Jane","family_name":"Doe","sub":"google-sub-1","picture":"http://pic"}"""));

        var result = await sut.ExchangeCodeForTokenAsync("code");

        Assert.Equal("new@example.com", result.User.Email);
        Assert.Equal("Jane Doe", result.User.Name);
        Assert.NotEmpty(result.Token);
        var stored = db.Users.Single();
        Assert.Equal("google", stored.AuthProvider);
        Assert.Equal("google-sub-1", stored.ProviderUserId);
    }

    [Fact]
    public async Task ExchangeCodeForTokenAsync_WithExistingUserByEmail_UpdatesInPlace()
    {
        var db = TestDb.Create();
        var existing = new UserEntity
        {
            Id = Guid.NewGuid(),
            Email = "existing@example.com",
            AuthProvider = "email",
            PasswordHash = "hash",
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        db.Users.Add(existing);
        await db.SaveChangesAsync();

        var handler = new FakeHttpMessageHandler(req => req.RequestUri!.Host == "oauth2.googleapis.com"
            ? JsonResponse(HttpStatusCode.OK, "{\"access_token\":\"tok\"}")
            : JsonResponse(HttpStatusCode.OK, """{"email":"existing@example.com","given_name":"Jane","family_name":"Doe","sub":"google-sub-2"}"""));
        var httpClientFactory = new Mock<IHttpClientFactory>();
        httpClientFactory.Setup(f => f.CreateClient(It.IsAny<string>())).Returns(new HttpClient(handler));
        var sut = new GoogleAuthService(BuildConfig(), db, new JwtTokenService(BuildJwtConfig()), httpClientFactory.Object);

        var result = await sut.ExchangeCodeForTokenAsync("code");

        Assert.Equal(existing.Id, result.User.Id);
        Assert.Equal(1, db.Users.Count());
        Assert.Equal("google", db.Users.Single().AuthProvider);
        Assert.Equal("google-sub-2", db.Users.Single().ProviderUserId);
    }
}
