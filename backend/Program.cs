using RecruiterReply.Services;
using Microsoft.EntityFrameworkCore;
using RecruiterReply.Data;
using RecruiterReply.Entities;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddControllers();

// Add Swagger/OpenAPI
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddOpenApi();
builder.Services.AddSwaggerGen();

// Add CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend",
        builder => builder
            .WithOrigins("http://localhost:3000", "http://localhost:5173")
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

var app = builder.Build();

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseCors("AllowFrontend");
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