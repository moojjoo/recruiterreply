using RecruiterReply.Services;
using Microsoft.EntityFrameworkCore;

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

app.MapControllers();

app.Run();