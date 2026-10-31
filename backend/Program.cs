using RecruiterReply.Services;
using Microsoft.EntityFrameworkCore;
using RecruiterReply.Data;
using RecruiterReply.Entities;
using RecruiterReply.Middleware;
using RecruiterReply.Models;
using RecruiterReply.Observability;
using RecruiterReply.Repositories;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System.Threading.RateLimiting;
using RecruiterReply.Authentication;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.HttpOverrides;
using Amazon.DynamoDBv2;
using Amazon.KeyManagementService;
using System.Diagnostics;
using RecruiterReply.Serialization;

var envCandidates = new[]
{
    Path.Combine(Directory.GetCurrentDirectory(), ".env"),
    Path.Combine(Directory.GetCurrentDirectory(), ".env.local"),
    Path.Combine(Directory.GetCurrentDirectory(), "..", ".env"),
    Path.Combine(Directory.GetCurrentDirectory(), "..", ".env.local"),
    Path.Combine(Directory.GetCurrentDirectory(), "..", "..", ".env"),
    Path.Combine(Directory.GetCurrentDirectory(), "..", "..", ".env.local")
};

foreach (var envPath in envCandidates.Distinct())
{
    if (File.Exists(envPath))
    {
        DotNetEnv.Env.Load(envPath);
    }
}

var builder = WebApplication.CreateBuilder(args);
builder.Logging.ClearProviders();
builder.Logging.AddJsonConsole(options =>
{
    options.IncludeScopes = true;
    options.TimestampFormat = "yyyy-MM-dd'T'HH:mm:ss.fff'Z'";
    options.UseUtcTimestamp = true;
});
Activity.DefaultIdFormat = ActivityIdFormat.W3C;
Activity.ForceDefaultIdFormat = true;

// Load secrets from AWS Secrets Manager when deployed. No-op locally: only runs if
// Aws:SecretsManager:SecretName (or AWS_SECRETS_MANAGER_SECRET_NAME) is set. Added last so it
// overrides appsettings.json, user-secrets, and plain env vars — Secrets Manager is
// authoritative wherever it's configured. Uses the EC2 instance's IAM role automatically.
var secretsManagerSecretName = builder.Configuration["Aws:SecretsManager:SecretName"]
    ?? Environment.GetEnvironmentVariable("AWS_SECRETS_MANAGER_SECRET_NAME");
if (!string.IsNullOrWhiteSpace(secretsManagerSecretName))
{
    var secretValues = AwsSecretsLoader.FetchFlattenedSecretsAsync(secretsManagerSecretName).GetAwaiter().GetResult();
    builder.Configuration.AddInMemoryCollection(secretValues);
}

// Legacy auth is a deployment mode, not a secret. Apply an explicit deployment
// setting after Secrets Manager so a stale non-secret value in the secret document
// cannot silently override the environment's approved authentication mode.
DeploymentConfigurationOverrides.ApplyLegacyAuth(
    builder.Configuration,
    Environment.GetEnvironmentVariable("LEGACY_AUTH_ENABLED"));

// Email/password and legacy Google authentication remain supported by default
// in every environment. An environment may still explicitly opt into the
// Cognito-only BFF path by setting LegacyAuth:Enabled to false.
const bool legacyAuthEnabledByDefault = true;
var legacyAuthEnabled = builder.Configuration.GetValue(
    "LegacyAuth:Enabled", legacyAuthEnabledByDefault);

// Add services to the container
builder.Services.AddControllers().AddJsonOptions(options =>
{
    options.JsonSerializerOptions.Converters.Add(new UtcDateTimeJsonConverter());
    options.JsonSerializerOptions.Converters.Add(new UtcDateTimeOffsetJsonConverter());
});
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    // nginx is the only public reverse proxy for the hosted API. The container
    // receives its forwarded headers from the host-side private network.
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
});
builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = "X-CSRF-TOKEN";
    options.Cookie.Name = "__Host-rr_csrf";
    options.Cookie.HttpOnly = false;
    options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
    options.Cookie.SameSite = SameSiteMode.Strict;
    options.Cookie.Path = "/";
});
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("password-recovery", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 5, Window = TimeSpan.FromMinutes(15), QueueLimit = 0 }));
    options.AddPolicy("consent-audit", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 30, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
    options.AddPolicy("frontend-telemetry", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 20, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
});
builder.Services.AddHttpClient();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<FrontendTelemetryQueue>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<FrontendTelemetryQueue>());
builder.Services.Configure<CognitoBffOptions>(builder.Configuration.GetSection("CognitoBff"));
builder.Services.AddSingleton<IAmazonDynamoDB>(_ => new AmazonDynamoDBClient());
builder.Services.AddSingleton<IAmazonKeyManagementService>(_ => new AmazonKeyManagementServiceClient());
builder.Services.AddSingleton<IBffSessionStore, DynamoDbBffSessionStore>();
builder.Services.AddSingleton<ICognitoBffService, CognitoBffService>();
builder.Services.AddScoped<IOrganizationAuthorizationService, OrganizationAuthorizationService>();

var githubOidcOptions = new GitHubActionsOidcPolicyOptions(
    builder.Configuration.GetValue<bool>("GitHubActionsOidc:Enabled"),
    builder.Configuration["GitHubActionsOidc:Issuer"] ?? "https://token.actions.githubusercontent.com",
    builder.Configuration["GitHubActionsOidc:Audience"] ?? "recruiterreply-dev-smoke",
    builder.Configuration["GitHubActionsOidc:Repository"] ?? "moojjoo/recruiterreply",
    builder.Configuration["GitHubActionsOidc:WorkflowRef"] ?? "moojjoo/recruiterreply/.github/workflows/promote.yml@refs/heads/main",
    builder.Configuration["GitHubActionsOidc:Ref"] ?? "refs/heads/main",
    builder.Configuration["GitHubActionsOidc:Environment"] ?? "dev");

builder.Services.AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme = "Application";
        options.DefaultChallengeScheme = "Application";
    })
    .AddPolicyScheme("Application", null, options =>
    {
        options.ForwardDefaultSelector = context =>
        {
            // Google login stores a legacy JWT while the private Dev boundary
            // also supplies rr_session. Prefer the explicit bearer token so
            // /auth/me resolves the account that just completed Google login.
            var hasBearerToken = legacyAuthEnabled && context.Request.Headers.Authorization.Any(value =>
                value is not null && value.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase));

            return hasBearerToken
                ? JwtBearerDefaults.AuthenticationScheme
                : context.Request.Cookies.ContainsKey(BffSessionAuthenticationHandler.CookieName)
                    ? BffSessionAuthenticationHandler.SchemeName
                    : context.Request.Cookies.ContainsKey("rr_session")
                        ? "EdgeSession"
                        : legacyAuthEnabled
                            ? JwtBearerDefaults.AuthenticationScheme
                            : BffSessionAuthenticationHandler.SchemeName;
        };
    })
    .AddJwtBearer(options =>
    {
        var issuer = builder.Configuration["Jwt:Issuer"] ?? "RecruiterReply";
        var audience = builder.Configuration["Jwt:Audience"] ?? "RecruiterReply.Client";
        var key = builder.Configuration["Jwt:Key"] ?? "REPLACE_WITH_32_CHAR_OR_LONGER_SECRET";

        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = issuer,
            ValidAudience = audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key))
        };
    })
    .AddScheme<AuthenticationSchemeOptions, EdgeSessionAuthenticationHandler>("EdgeSession", _ => { })
    .AddScheme<AuthenticationSchemeOptions, BffSessionAuthenticationHandler>(BffSessionAuthenticationHandler.SchemeName, _ => { })
    .AddJwtBearer("GitHubActionsSmoke", options =>
    {
        options.Authority = githubOidcOptions.Issuer;
        options.Audience = githubOidcOptions.Audience;
        options.RequireHttpsMetadata = true;
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = githubOidcOptions.Issuer,
            ValidateAudience = true,
            ValidAudience = githubOidcOptions.Audience,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30)
        };
        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = context =>
            {
                if (!GitHubActionsOidcPolicy.IsApproved(context.Principal, githubOidcOptions))
                {
                    context.Fail("GitHub Actions identity is not approved for Dev smoke tests.");
                }

                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization(options =>
{
    // New controllers and minimal API endpoints must be authenticated unless
    // they explicitly opt into the reviewed anonymous-route inventory.
    options.FallbackPolicy = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();

    options.AddPolicy("GitHubActionsSmoke", policy =>
    {
        policy.AddAuthenticationSchemes("GitHubActionsSmoke");
        policy.RequireAuthenticatedUser();
    });
});

// Add Swagger/OpenAPI
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddOpenApi();
builder.Services.AddSwaggerGen();

// Add CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy(
        "AllowFrontend",
        FrontendCorsPolicy.Create(builder.Configuration, builder.Environment.IsDevelopment()));
});

// Add PostgreSQL DbContext
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException("ConnectionStrings:DefaultConnection is not configured.");
}

builder.Services.AddHostedService<ConsentAuditRetentionService>();
builder.Services.AddDbContext<RecruiterReplyDbContext>(options =>
    options.UseNpgsql(connectionString));

// Add OpenAI Service (placeholder-safe for dev/test startup)
var openAiKey = builder.Configuration["OpenAI:ApiKey"];
if (string.IsNullOrWhiteSpace(openAiKey) || openAiKey == "sk-proj-YOUR_KEY_HERE")
{
    // Support common single-var naming in local shells and CI.
    openAiKey = Environment.GetEnvironmentVariable("OPENAI_API_KEY");
}
if (string.IsNullOrWhiteSpace(openAiKey))
{
    openAiKey = "sk-proj-NOT_CONFIGURED";
}
var openAiModel = builder.Configuration["OpenAI:Model"];
builder.Services.AddSingleton<IOpenAIService>(sp =>
    new OpenAIService(openAiKey, sp.GetRequiredService<ILogger<OpenAIService>>(), model: openAiModel));

// Configure Stripe billing (test-mode key until the account goes live). No-op if unset —
// billing endpoints will fail at call time rather than at startup, same pattern as OpenAI above.
Stripe.StripeConfiguration.ApiKey = builder.Configuration["Stripe:SecretKey"];

// Add application services
builder.Services.AddScoped<IAnalysisService, AnalysisService>();
builder.Services.AddScoped<IReplyService, ReplyService>();
builder.Services.AddScoped<IComparisonService, ComparisonService>();
builder.Services.AddScoped<IPasswordHashService, PasswordHashService>();
builder.Services.AddScoped<IRecoveryEmailSender, SesRecoveryEmailSender>();
builder.Services.AddScoped<IJwtTokenService, JwtTokenService>();
builder.Services.AddScoped<IGoogleAuthService, GoogleAuthService>();
builder.Services.AddScoped<IDefaultUserService, DefaultUserService>();
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IMessageRepository, MessageRepository>();
builder.Services.AddScoped<IOpportunityRepository, OpportunityRepository>();
builder.Services.AddScoped<IUsageRepository, UsageRepository>();
builder.Services.AddScoped<IUsageService, UsageService>();
builder.Services.AddScoped<IBillingService, BillingService>();

// Add Gmail recruiting agent services
builder.Services.Configure<GmailOptions>(builder.Configuration.GetSection("Gmail"));
builder.Services.Configure<RecruiterRulesOptions>(builder.Configuration.GetSection("RecruiterRules"));

var dataProtectionKeysPath = builder.Configuration["Gmail:DataProtectionKeysPath"];
if (string.IsNullOrWhiteSpace(dataProtectionKeysPath))
{
    dataProtectionKeysPath = "keys";
}
// NOTE: for a real deploy this must be an absolute path outside the app's own deploy
// directory (e.g. /etc/recruiterreply/keys), or a redeploy that replaces the app directory
// will silently strand every stored Gmail token. Relative "keys" is dev-only.
builder.Services.AddDataProtection()
    .PersistKeysToFileSystem(new DirectoryInfo(dataProtectionKeysPath))
    .SetApplicationName("RecruiterReply");

builder.Services.AddScoped<IGmailConnectionRepository, GmailConnectionRepository>();
builder.Services.AddScoped<IGmailOAuthService, GmailOAuthService>();
builder.Services.AddScoped<IGmailApiClient, GmailApiClient>();
builder.Services.AddScoped<IRecruiterInboxRepository, RecruiterInboxRepository>();
builder.Services.AddScoped<IRecruiterActionService, RecruiterActionService>();
builder.Services.AddScoped<IRecruiterPipelineService, RecruiterPipelineService>();
builder.Services.AddScoped<IGmailSyncService, GmailSyncService>();
builder.Services.AddHostedService<GmailPollingBackgroundService>();

var app = builder.Build();

var shouldAutoMigrate = builder.Configuration.GetValue<bool>("Database:AutoMigrate");
if (shouldAutoMigrate)
{
    // Applies pending EF Core migrations on startup. Intended for dev/test; prod
    // migrations should be run as a deliberate step alongside the deploy instead.
    using var scope = app.Services.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<RecruiterReplyDbContext>();
    dbContext.Database.Migrate();
}

// Configure the HTTP request pipeline
// Development mode is also used by the hosted Dev container. Swagger must be
// an explicit local opt-in so it is not exposed by environment name alone.
if (app.Environment.IsDevelopment() && builder.Configuration.GetValue<bool>("Swagger:Enabled"))
{
    app.MapOpenApi();
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseMiddleware<ErrorHandlingMiddleware>();
app.UseMiddleware<RequestLoggingMiddleware>();
app.Use(async (context, next) =>
{
    context.Response.OnStarting(() =>
    {
        context.Response.Headers.TryAdd("X-Trace-Id", Activity.Current?.TraceId.ToString() ?? context.TraceIdentifier);
        return Task.CompletedTask;
    });
    await next();
});
app.UseForwardedHeaders();
app.UseMiddleware<PrivateApiOriginAuthMiddleware>();

// Redirecting the CORS preflight to HTTPS breaks the browser's http://localhost:5002 calls in dev.
if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}
app.UseCors("AllowFrontend");
app.UseRateLimiter();
app.UseAuthentication();
app.UseMiddleware<BffCsrfMiddleware>();
app.UseAuthorization();

app.MapGet("/", () => Results.Ok(new { service = "recruiterreply-backend", status = "ok" }))
    .AllowAnonymous();

// nginx prepends /api to all requests, so these are also mapped under /api for external reachability.
Func<IResult> healthHandler = () => Results.Ok(new { status = "healthy" });
app.MapGet("/health", healthHandler).AllowAnonymous();
app.MapGet("/api/health", healthHandler).AllowAnonymous();
app.MapGet("/health/ci", () => Results.Ok(new { status = "healthy", smoke = "github-actions-oidc" }))
    .RequireAuthorization("GitHubActionsSmoke");
app.MapGet("/api/health/ci", () => Results.Ok(new { status = "healthy", smoke = "github-actions-oidc" }))
    .RequireAuthorization("GitHubActionsSmoke");

Func<RecruiterReplyDbContext, CancellationToken, Task<IResult>> healthDbHandler = async (db, ct) =>
{
    var canConnect = await db.Database.CanConnectAsync(ct);
    if (!canConnect)
    {
        return Results.Problem("Database connection failed", statusCode: 503);
    }

    return Results.Ok(new
    {
        status = "healthy",
        database = "connected"
    });
};
app.MapGet("/health/db", healthDbHandler).RequireAuthorization();
app.MapGet("/api/health/db", healthDbHandler).RequireAuthorization();

Func<IResult> healthApisHandler = () =>
{
    var configuredOpenAiKey = builder.Configuration["OpenAI:ApiKey"];
    if (string.IsNullOrWhiteSpace(configuredOpenAiKey) || configuredOpenAiKey == "sk-proj-YOUR_KEY_HERE")
    {
        configuredOpenAiKey = Environment.GetEnvironmentVariable("OPENAI_API_KEY");
    }

    var hasOpenAiKey = !string.IsNullOrWhiteSpace(configuredOpenAiKey)
        && configuredOpenAiKey != "sk-proj-YOUR_KEY_HERE"
        && configuredOpenAiKey != "sk-proj-NOT_CONFIGURED";

    return Results.Ok(new
    {
        status = "healthy",
        services = new
        {
            openAiConfigured = hasOpenAiKey,
            openAiModel = string.IsNullOrWhiteSpace(openAiModel) ? OpenAIService.DefaultModel : openAiModel,
            analysisApi = true,
            replyApi = true,
            comparisonApi = true
        }
    });
};
app.MapGet("/health/apis", healthApisHandler).RequireAuthorization();
app.MapGet("/api/health/apis", healthApisHandler).RequireAuthorization();

Func<RecruiterReplyDbContext, CancellationToken, Task<IResult>> healthGmailHandler = async (db, ct) =>
{
    var gmailClientId = builder.Configuration["Gmail:ClientId"];
    var gmailClientSecret = builder.Configuration["Gmail:ClientSecret"];
    var isConfigured = !string.IsNullOrWhiteSpace(gmailClientId) && !string.IsNullOrWhiteSpace(gmailClientSecret);

    return Results.Ok(new
    {
        status = "healthy",
        gmail = new
        {
            configured = isConfigured
        }
    });
};
app.MapGet("/health/gmail", healthGmailHandler).RequireAuthorization();
app.MapGet("/api/health/gmail", healthGmailHandler).RequireAuthorization();

Func<RecruiterReplyDbContext, IDefaultUserService, TimeProvider, CancellationToken, Task<IResult>> healthCrudHandler = async (db, defaultUserService, timeProvider, ct) =>
{
    var userId = await defaultUserService.GetOrCreateDefaultUserIdAsync(ct);
    await using var tx = await db.Database.BeginTransactionAsync(ct);

    var message = new MessageEntity
    {
        Id = Guid.NewGuid(),
        UserId = userId,
        Subject = "health-check",
        Body = "health-check-body",
        CompanyName = "health-check",
        CreatedAt = timeProvider.GetUtcNow().UtcDateTime
    };

    db.Messages.Add(message);
    await db.SaveChangesAsync(ct);

    message.Subject = "health-check-updated";
    await db.SaveChangesAsync(ct);

    db.Messages.Remove(message);
    await db.SaveChangesAsync(ct);

    await tx.RollbackAsync(ct);

    return Results.Ok(new
    {
        status = "healthy",
        crud = new { create = true, read = true, update = true, delete = true }
    });
};
app.MapGet("/health/crud", healthCrudHandler).RequireAuthorization();
app.MapGet("/api/health/crud", healthCrudHandler).RequireAuthorization();

app.MapControllers();

app.Run();
