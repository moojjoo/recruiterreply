using System.Text.Json;
using System.Diagnostics;

namespace RecruiterReply.Middleware;

public class ErrorHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ErrorHandlingMiddleware> _logger;

    public ErrorHandlingMiddleware(RequestDelegate next, ILogger<ErrorHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(
                ex,
                "Request validation failed eventName={EventName} path={Path} traceId={TraceId}",
                "RequestValidationFailed",
                context.Request.Path.ToString().Replace("\r", "").Replace("\n", ""), Activity.Current?.TraceId.ToString() ?? context.TraceIdentifier);
            await WriteErrorAsync(context, StatusCodes.Status400BadRequest, "Invalid request.");
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Unhandled request exception eventName={EventName} path={Path} traceId={TraceId}",
                "UnhandledRequestException",
                context.Request.Path.ToString().Replace("\r", "").Replace("\n", ""), Activity.Current?.TraceId.ToString() ?? context.TraceIdentifier);
            await WriteErrorAsync(context, StatusCodes.Status500InternalServerError, "An unexpected error occurred.");
        }
    }

    private static Task WriteErrorAsync(HttpContext context, int statusCode, string message)
    {
        context.Response.ContentType = "application/json";
        context.Response.StatusCode = statusCode;

        var payload = JsonSerializer.Serialize(new
        {
            error = message,
            statusCode,
            traceId = Activity.Current?.TraceId.ToString() ?? context.TraceIdentifier
        });

        return context.Response.WriteAsync(payload);
    }
}
