using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RecruiterReply.Authentication;

#pragma warning disable CS0618

namespace RecruiterReply.Tests;

public sealed class AuthenticationSchemeIsolationTests
{
    [Fact]
    public async Task AuthenticationMiddleware_BffMode_PerimeterCookieCannotAuthenticateOrProvisionApplicationUser()
    {
        var tracker = new SchemeTracker();
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSingleton(tracker);
        services.AddAuthentication(options =>
            {
                options.DefaultAuthenticateScheme = "Application";
                options.DefaultChallengeScheme = "Application";
            })
            .AddPolicyScheme("Application", null, options =>
            {
                options.ForwardDefaultSelector = context =>
                    ApplicationAuthenticationSchemeSelector.Select(context, legacyAuthEnabled: false, cognitoBffEnabled: true);
            })
            .AddScheme<AuthenticationSchemeOptions, NoResultBffHandler>(BffSessionAuthenticationHandler.SchemeName, _ => { })
            .AddScheme<AuthenticationSchemeOptions, ProvisioningEdgeHandler>("EdgeSession", _ => { });
        await using var provider = services.BuildServiceProvider();
        await using var scope = provider.CreateAsyncScope();
        var context = new DefaultHttpContext { RequestServices = scope.ServiceProvider };
        context.Request.Headers.Cookie = "rr_session=synthetic-valid-perimeter-session";
        var nextReached = false;
        var middleware = new AuthenticationMiddleware(_ =>
            {
                nextReached = true;
                return Task.CompletedTask;
            }, scope.ServiceProvider.GetRequiredService<IAuthenticationSchemeProvider>());

        await middleware.Invoke(context);

        Assert.True(nextReached);
        Assert.False(context.User.Identity?.IsAuthenticated ?? false);
        Assert.Equal(1, tracker.BffAttempts);
        Assert.Equal(0, tracker.EdgeAttempts);
        Assert.Equal(0, tracker.ProvisionedProfiles);
    }

    [Fact]
    public void Selector_RetainsEdgeSessionOnlyOutsideBffMode()
    {
        var context = new DefaultHttpContext();
        context.Request.Headers.Cookie = "rr_session=synthetic-valid-perimeter-session";

        Assert.Equal(BffSessionAuthenticationHandler.SchemeName,
            ApplicationAuthenticationSchemeSelector.Select(context, legacyAuthEnabled: false, cognitoBffEnabled: true));
        Assert.Equal("EdgeSession",
            ApplicationAuthenticationSchemeSelector.Select(context, legacyAuthEnabled: true, cognitoBffEnabled: false));
        Assert.Equal(BffSessionAuthenticationHandler.SchemeName,
            ApplicationAuthenticationSchemeSelector.Select(context, legacyAuthEnabled: false, cognitoBffEnabled: false));
    }

    [Fact]
    public void Selector_LegacyBearerRequiresExplicitLegacyMode()
    {
        var context = new DefaultHttpContext();
        context.Request.Headers.Authorization = "Bearer synthetic-token";
        context.Request.Headers.Cookie = "rr_session=synthetic-valid-perimeter-session";

        Assert.Equal(JwtBearerDefaults.AuthenticationScheme,
            ApplicationAuthenticationSchemeSelector.Select(context, legacyAuthEnabled: true, cognitoBffEnabled: true));
        Assert.Equal(BffSessionAuthenticationHandler.SchemeName,
            ApplicationAuthenticationSchemeSelector.Select(context, legacyAuthEnabled: false, cognitoBffEnabled: true));
    }

    [Theory]
    [InlineData("rr_session=perimeter", null)]
    [InlineData("rr_session=perimeter; __Host-rr_session=application", null)]
    [InlineData("rr_session=perimeter", "Bearer synthetic-token")]
    [InlineData("rr_session=perimeter; __Host-rr_session=application", "Bearer synthetic-token")]
    public void Selector_BffModeWithLegacyDisabledNeverFallsBackToEdge(string cookie, string? authorization)
    {
        var context = new DefaultHttpContext();
        context.Request.Headers.Cookie = cookie;
        if (authorization is not null) context.Request.Headers.Authorization = authorization;

        Assert.Equal(BffSessionAuthenticationHandler.SchemeName,
            ApplicationAuthenticationSchemeSelector.Select(context, legacyAuthEnabled: false, cognitoBffEnabled: true));
    }

    private sealed class SchemeTracker
    {
        public int BffAttempts { get; set; }
        public int EdgeAttempts { get; set; }
        public int ProvisionedProfiles { get; set; }
    }

    private sealed class NoResultBffHandler : AuthenticationHandler<AuthenticationSchemeOptions>
    {
        private readonly SchemeTracker _tracker;

        public NoResultBffHandler(IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger,
            UrlEncoder encoder, ISystemClock clock, SchemeTracker tracker) : base(options, logger, encoder, clock)
            => _tracker = tracker;

        protected override Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            _tracker.BffAttempts++;
            return Task.FromResult(AuthenticateResult.NoResult());
        }
    }

    private sealed class ProvisioningEdgeHandler : AuthenticationHandler<AuthenticationSchemeOptions>
    {
        private readonly SchemeTracker _tracker;

        public ProvisioningEdgeHandler(IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger,
            UrlEncoder encoder, ISystemClock clock, SchemeTracker tracker) : base(options, logger, encoder, clock)
            => _tracker = tracker;

        protected override Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            _tracker.EdgeAttempts++;
            _tracker.ProvisionedProfiles++;
            var principal = new ClaimsPrincipal(new ClaimsIdentity(
                [new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString())], Scheme.Name));
            return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(principal, Scheme.Name)));
        }
    }
}

#pragma warning restore CS0618
