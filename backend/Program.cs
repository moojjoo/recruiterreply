using RecruiterReply.Services;
using Microsoft.EntityFrameworkCore;
using RecruiterReply.Data;
using RecruiterReply.Entities;
using RecruiterReply.Middleware;
using RecruiterReply.Repositories;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

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

// Add OpenAI Service
var openAiKey = builder.Configuration["OpenAI:ApiKey"];
if (string.IsNullOrEmpty(openAiKey))
{
    throw new InvalidOperationException("OpenAI:ApiKey is not configured in appsettings.json. Please set it before running.");
}
builder.Services.AddSingleton<IOpenAIService>(sp => 
    new OpenAIService(openAiKey, sp.GetRequiredService<ILogger<OpenAIService>>()));

// Add application services
builder.Services.AddScoped<IAnalysisService, AnalysisService>();
builder.Services.AddScoped<IReplyService, ReplyService>();
builder.Services.AddScoped<IComparisonService, ComparisonService>();
builder.Services.AddScoped<IDefaultUserService, DefaultUserService>();
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IMessageRepository, MessageRepository>();
builder.Services.AddScoped<IOpportunityRepository, OpportunityRepository>();

var app = builder.Build();

var shouldAutoCreateSchema = builder.Configuration.GetValue<bool>("Database:AutoCreateSchema");
if (shouldAutoCreateSchema)
{
    // Keep local/dev schema in sync for non-migration bootstrap environments.
    using var scope = app.Services.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<RecruiterReplyDbContext>();
    dbContext.Database.EnsureCreated();
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
    var hasOpenAiKey = !string.IsNullOrWhiteSpace(builder.Configuration["OpenAI:ApiKey"])
        && builder.Configuration["OpenAI:ApiKey"] != "sk-proj-YOUR_KEY_HERE";

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