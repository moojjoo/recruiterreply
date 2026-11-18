using System.Net;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RecruiterReply.Documentation;
using RecruiterReply.Middleware;

#pragma warning disable CS0618

namespace RecruiterReply.Tests.Documentation;

public sealed class ProtectedApiDocumentationTests
{
    private const string SigningKey = "synthetic-private-origin-signing-key-for-tests";

    [Theory]
    [InlineData(Environments.Development, true, true)]
    [InlineData(Environments.Development, false, false)]
    [InlineData(Environments.Staging, true, true)]
    [InlineData(Environments.Staging, false, false)]
    [InlineData(Environments.Production, true, false)]
    [InlineData(Environments.Production, false, false)]
    [InlineData("Preview", true, false)]
    public void IsEnabled_RequiresExplicitSupportedNonProductionEnvironment(
        string environmentName, bool flag, bool expected)
    {
        var environment = new TestHostEnvironment { EnvironmentName = environmentName };
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Swagger:Enabled"] = flag.ToString()
        }).Build();

        Assert.Equal(expected, ProtectedApiDocumentation.IsEnabled(environment, configuration));
    }

    [Theory]
    [InlineData("/swagger")]
    [InlineData("/swagger/index.html")]
    [InlineData("/openapi/v1.json")]
    [InlineData("/api/openapi/v1.json")]
    public void IsBlockedAlias_RejectsAlternateDocumentationRoutes(string path)
    {
        Assert.True(ProtectedApiDocumentationMiddleware.IsBlockedAlias(path));
    }

    [Fact]
    public async Task Development_DocumentationRequiresOriginAndApplicationAuthentication()
    {
        await using var host = await DocumentationHost.StartAsync(Environments.Development, enabled: true);

        Assert.Equal(HttpStatusCode.Forbidden,
            (await host.SendAsync("/api/swagger/index.html", appAuthenticated: true, signOrigin: false)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await host.SendAsync("/api/swagger/index.html", appAuthenticated: true,
                signOrigin: true, validSignature: false)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await host.SendAsync("/api/swagger/index.html", appAuthenticated: false, signOrigin: true)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await host.SendAsync("/api/swagger/index.html", appAuthenticated: false,
                signOrigin: true, perimeterOnly: true)).StatusCode);

        var ui = await host.SendAsync("/api/swagger/index.html", appAuthenticated: true, signOrigin: true);
        Assert.Equal(HttpStatusCode.OK, ui.StatusCode);
        Assert.Equal("no-store", ui.Headers.CacheControl?.ToString());
        var uiBody = await ui.Content.ReadAsStringAsync();
        Assert.Contains("./v1/swagger.json", uiBody);
        Assert.Contains("supportedSubmitMethods: []", uiBody);

        var specification = await host.SendAsync(
            ProtectedApiDocumentation.DocumentRoute, appAuthenticated: true, signOrigin: true);
        Assert.Equal(HttpStatusCode.OK, specification.StatusCode);
        Assert.Contains("/api/sample", await specification.Content.ReadAsStringAsync());

        Assert.Equal(HttpStatusCode.OK,
            (await host.SendAsync("/api/swagger/swagger-ui.css", appAuthenticated: true, signOrigin: true)).StatusCode);
    }

    [Theory]
    [InlineData("/swagger")]
    [InlineData("/swagger/v1/swagger.json")]
    [InlineData("/openapi/v1.json")]
    [InlineData("/api/openapi/v1.json")]
    public async Task AlternateDocumentationRoutesRemainUnavailable(string path)
    {
        await using var host = await DocumentationHost.StartAsync(Environments.Development, enabled: true);

        var response = await host.SendAsync(path, appAuthenticated: true, signOrigin: true);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("no-store", response.Headers.CacheControl?.ToString());
    }

    [Theory]
    [InlineData(Environments.Development, false)]
    [InlineData(Environments.Staging, false)]
    [InlineData(Environments.Production, true)]
    public async Task DisabledOrProduction_DocumentationReturnsNotFound(string environment, bool flag)
    {
        await using var host = await DocumentationHost.StartAsync(environment, flag);

        var response = await host.SendAsync(
            "/api/swagger/index.html", appAuthenticated: true, signOrigin: true);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("no-store", response.Headers.CacheControl?.ToString());
    }

    [Fact]
    public async Task RepresentativeApiAuthorizationRemainsEnforced()
    {
        await using var host = await DocumentationHost.StartAsync(Environments.Development, enabled: true);

        Assert.Equal(HttpStatusCode.Unauthorized,
            (await host.SendAsync("/api/sample", appAuthenticated: false, signOrigin: true)).StatusCode);
        Assert.Equal(HttpStatusCode.OK,
            (await host.SendAsync("/api/sample", appAuthenticated: true, signOrigin: true)).StatusCode);
    }

    private sealed class DocumentationHost : IAsyncDisposable
    {
        private readonly WebApplication _application;
        private readonly HttpClient _client;

        private DocumentationHost(WebApplication application, HttpClient client)
        {
            _application = application;
            _client = client;
        }

        public static async Task<DocumentationHost> StartAsync(string environment, bool enabled)
        {
            var builder = WebApplication.CreateBuilder(new WebApplicationOptions
            {
                EnvironmentName = environment
            });
            builder.WebHost.UseKestrel().UseUrls("http://127.0.0.1:0");
            builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Swagger:Enabled"] = enabled.ToString(),
                ["PrivateApiOriginAuth:Enabled"] = "true",
                ["apiOriginSigningKey"] = SigningKey
            });
            builder.Services.AddRouting();
            builder.Services.AddEndpointsApiExplorer();
            builder.Services.AddSwaggerGen();
            builder.Services.AddAuthentication("Application")
                .AddScheme<AuthenticationSchemeOptions, TestApplicationAuthHandler>("Application", _ => { });
            builder.Services.AddAuthorization(options =>
            {
                options.FallbackPolicy = new AuthorizationPolicyBuilder()
                    .RequireAuthenticatedUser()
                    .Build();
            });

            var app = builder.Build();
            app.UseMiddleware<PrivateApiOriginAuthMiddleware>();
            app.UseProtectedApiDocumentationGuard();
            app.UseAuthentication();
            app.UseAuthorization();
            app.UseProtectedApiDocumentation();
            app.MapGet("/api/sample", () => Results.Ok(new { status = "ok" })).RequireAuthorization();
            await app.StartAsync();

            var addresses = app.Services.GetRequiredService<IServer>()
                .Features.Get<IServerAddressesFeature>()?.Addresses
                ?? throw new InvalidOperationException("Test server did not publish an address.");
            var client = new HttpClient { BaseAddress = new Uri(addresses.Single()) };
            return new DocumentationHost(app, client);
        }

        public async Task<HttpResponseMessage> SendAsync(
            string path,
            bool appAuthenticated,
            bool signOrigin,
            bool validSignature = true,
            bool perimeterOnly = false)
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, path);
            if (appAuthenticated) request.Headers.Add("X-Test-App-Auth", "true");
            if (perimeterOnly) request.Headers.Add("Cookie", "rr_session=synthetic-perimeter-session");
            if (signOrigin)
            {
                request.Headers.Add("X-RR-Origin-Auth", validSignature
                    ? CreateOriginSignature(request.Method.Method, new Uri(_client.BaseAddress!, path))
                    : "invalid");
            }
            return await _client.SendAsync(request);
        }

        public async ValueTask DisposeAsync()
        {
            _client.Dispose();
            await _application.StopAsync();
            await _application.DisposeAsync();
        }

        private static string CreateOriginSignature(string method, Uri uri)
        {
            var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString();
            var canonical = $"{timestamp}\n{method}\n{uri.AbsolutePath}\n{uri.Query.TrimStart('?')}";
            var signature = HMACSHA256.HashData(Encoding.UTF8.GetBytes(SigningKey), Encoding.UTF8.GetBytes(canonical));
            return $"{timestamp}.{Convert.ToBase64String(signature).TrimEnd('=').Replace('+', '-').Replace('/', '_')}";
        }
    }

    private sealed class TestApplicationAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
    {
        public TestApplicationAuthHandler(
            IOptionsMonitor<AuthenticationSchemeOptions> options,
            ILoggerFactory logger,
            UrlEncoder encoder,
            ISystemClock clock) : base(options, logger, encoder, clock) { }

        protected override Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            if (Request.Headers["X-Test-App-Auth"] != "true")
                return Task.FromResult(AuthenticateResult.NoResult());

            var identity = new ClaimsIdentity(
                [new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString())],
                Scheme.Name);
            return Task.FromResult(AuthenticateResult.Success(
                new AuthenticationTicket(new ClaimsPrincipal(identity), Scheme.Name)));
        }
    }

    private sealed class TestHostEnvironment : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = Environments.Development;
        public string ApplicationName { get; set; } = "RecruiterReply.Tests";
        public string ContentRootPath { get; set; } = Directory.GetCurrentDirectory();
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}

#pragma warning restore CS0618
