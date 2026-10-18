using Microsoft.AspNetCore.Antiforgery;

namespace RecruiterReply.Middleware;

/// <summary>Protects cookie-authenticated BFF mutations during migration.</summary>
public sealed class BffCsrfMiddleware
{
    private static readonly HashSet<string> SafeMethods = new(StringComparer.OrdinalIgnoreCase)
    {
        "GET", "HEAD", "OPTIONS", "TRACE"
    };

    private readonly RequestDelegate _next;
    private readonly IAntiforgery _antiforgery;
    private readonly IConfiguration _configuration;
    private readonly ILogger<BffCsrfMiddleware> _logger;

    public BffCsrfMiddleware(RequestDelegate next, IAntiforgery antiforgery,
        IConfiguration configuration, ILogger<BffCsrfMiddleware> logger)
    {
        _next = next;
        _antiforgery = antiforgery;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (!ShouldValidate(context))
        {
            await _next(context);
            return;
        }

        if (!IsAllowedOrigin(context))
        {
            _logger.LogWarning("Rejected BFF mutation with an untrusted origin: {Origin}",
                context.Request.Headers.Origin.ToString());
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return;
        }

        try
        {
            await _antiforgery.ValidateRequestAsync(context);
        }
        catch (AntiforgeryValidationException)
        {
            _logger.LogWarning("Rejected BFF mutation with an invalid CSRF token");
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            return;
        }

        await _next(context);
    }

    private bool ShouldValidate(HttpContext context) =>
        _configuration.GetValue<bool>("CognitoBff:CsrfEnabled")
        && !SafeMethods.Contains(context.Request.Method)
        && context.Request.Path.StartsWithSegments("/api")
        && !context.Request.Path.StartsWithSegments("/api/auth/csrf")
        && context.Request.Cookies.ContainsKey("__Host-rr_session");

    private bool IsAllowedOrigin(HttpContext context)
    {
        var origin = context.Request.Headers.Origin.ToString();
        if (string.IsNullOrWhiteSpace(origin) && Uri.TryCreate(
            context.Request.Headers.Referer.ToString(), UriKind.Absolute, out var referer))
        {
            origin = referer.GetLeftPart(UriPartial.Authority);
        }

        var allowed = _configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
        return allowed.Contains(origin, StringComparer.OrdinalIgnoreCase);
    }
}
