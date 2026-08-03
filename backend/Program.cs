using RecruiterReply.Services;
using Microsoft.EntityFrameworkCore;
using RecruiterReply.Data;
using RecruiterReply.Entities;
using RecruiterReply.Middleware;
using RecruiterReply.Models;
using RecruiterReply.Repositories;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.IdentityModel.Tokens;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

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

// Add services to the container
builder.Services.AddControllers();

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
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
    });

builder.Services.AddAuthorization();

// Add Swagger/OpenAPI
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddOpenApi();
builder.Services.AddSwaggerGen();

// Add CORS
builder.Services.AddCors(options =>
{
    var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
        ?? ["http://localhost:3000", "http://localhost:5173"];

    options.AddPolicy("AllowFrontend",
        policy => policy
            .WithOrigins(allowedOrigins)
            .AllowAnyMethod()
            .AllowAnyHeader());
});

// Add PostgreSQL DbContext
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException("ConnectionStrings:DefaultConnection is not configured.");
}

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
builder.Services.AddSingleton<IOpenAIService>(sp =>
    new OpenAIService(openAiKey, sp.GetRequiredService<ILogger<OpenAIService>>()));

// Add application services
builder.Services.AddScoped<IAnalysisService, AnalysisService>();
builder.Services.AddScoped<IReplyService, ReplyService>();
builder.Services.AddScoped<IComparisonService, ComparisonService>();
builder.Services.AddScoped<IPasswordHashService, PasswordHashService>();
builder.Services.AddScoped<IJwtTokenService, JwtTokenService>();
builder.Services.AddScoped<IDefaultUserService, DefaultUserService>();
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IMessageRepository, MessageRepository>();
builder.Services.AddScoped<IOpportunityRepository, OpportunityRepository>();

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
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseMiddleware<ErrorHandlingMiddleware>();
app.UseMiddleware<RequestLoggingMiddleware>();

app.UseHttpsRedirection();
app.UseCors("AllowFrontend");
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/", () => Results.Ok(new { service = "recruiterreply-backend", status = "ok" }));
app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));

app.MapGet("/health/db", async (RecruiterReplyDbContext db, CancellationToken ct) =>
{
    var canConnect = await db.Database.CanConnectAsync(ct);
    if (!canConnect)
    {
        return Results.Problem("Database connection failed", statusCode: 503);
    }

    var usersCount = await db.Users.CountAsync(ct);
    var messagesCount = await db.Messages.CountAsync(ct);

    return Results.Ok(new
    {
        status = "healthy",
        database = "postgres",
        probes = new
        {
            usersCount,
            messagesCount
        }
    });
});

app.MapGet("/health/apis", () =>
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
            analysisApi = true,
            replyApi = true,
            comparisonApi = true
        }
    });
});

app.MapGet("/health/gmail", async (RecruiterReplyDbContext db, CancellationToken ct) =>
{
    var gmailClientId = builder.Configuration["Gmail:ClientId"];
    var gmailClientSecret = builder.Configuration["Gmail:ClientSecret"];
    var isConfigured = !string.IsNullOrWhiteSpace(gmailClientId) && !string.IsNullOrWhiteSpace(gmailClientSecret);

    var activeConnections = await db.GmailConnections.CountAsync(c => c.Status == "active", ct);
    var errorConnections = await db.GmailConnections.CountAsync(c => c.Status == "error", ct);

    return Results.Ok(new
    {
        status = "healthy",
        gmail = new
        {
            configured = isConfigured,
            activeConnections,
            errorConnections
        }
    });
});

app.MapGet("/health/crud", async (RecruiterReplyDbContext db, IDefaultUserService defaultUserService, CancellationToken ct) =>
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
        CreatedAt = DateTime.UtcNow
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
});

app.MapControllers();

app.Run();