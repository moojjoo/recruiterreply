namespace RecruiterReply.Middleware;
using System.Diagnostics;

public class RequestLoggingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<RequestLoggingMiddleware> _logger;

    public RequestLoggingMiddleware(RequestDelegate next, ILogger<RequestLoggingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var startedAt = Stopwatch.GetTimestamp();
        await _next(context);
        var elapsedMs = Stopwatch.GetElapsedTime(startedAt).TotalMilliseconds;
        var level = context.Response.StatusCode >= 500 ? LogLevel.Error
            : context.Response.StatusCode >= 400 ? LogLevel.Warning : LogLevel.Information;

        _logger.Log(level,
            "HTTP request completed eventName={EventName} method={Method} path={Path} statusCode={StatusCode} elapsedMs={ElapsedMs} traceId={TraceId}",
            "HttpRequestCompleted",
            context.Request.Method.Replace("\r", "").Replace("\n", ""),
            context.Request.Path.ToString().Replace("\r", "").Replace("\n", ""),
            context.Response.StatusCode,
            Math.Round(elapsedMs, 2),
            Activity.Current?.TraceId.ToString() ?? context.TraceIdentifier);
    }
}
