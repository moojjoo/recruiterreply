using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace RecruiterReply.Middleware;

/// <summary>Rejects Test API calls that did not pass through the private Test edge gateway.</summary>
public sealed class PrivateApiOriginAuthMiddleware
{
    private const string HeaderName = "X-RR-Origin-Auth";
    private readonly RequestDelegate _next;
    private readonly bool _enabled;
    private readonly string? _signingKey;

    public PrivateApiOriginAuthMiddleware(RequestDelegate next, IConfiguration configuration)
    {
        _next = next;
        _enabled = configuration.GetValue<bool>("PrivateApiOriginAuth:Enabled");
        _signingKey = configuration["apiOriginSigningKey"];
        if (_enabled && (_signingKey is null || Encoding.UTF8.GetByteCount(_signingKey) < 32))
        {
            throw new InvalidOperationException("Private API origin signing is enabled but its signing key is missing or too short.");
        }
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (!_enabled)
        {
            await _next(context);
            return;
        }

        // Stripe cannot add the private edge-origin signature. The webhook
        // endpoint has its own provider signature verification in
        // BillingController/BillingService, so allow only that exact POST
        // route to reach the application without the private-origin header.
        if (IsStripeWebhook(context))
        {
            await _next(context);
            return;
        }

        // The shared deployment workflow probes the Test container directly on
        // its loopback-published port. Nginx adds X-Forwarded-For to every
        // externally reachable request, so this exception is host-local only.
        if (IsLocalHealthProbe(context))
        {
            await _next(context);
            return;
        }

        var signatures = context.Request.Headers[HeaderName];
        if (_signingKey is null || signatures.Count != 1 || !IsValidSignature(
            signatures[0],
            context.Request.Method,
            context.Request.Path.Value ?? string.Empty,
            (context.Request.QueryString.Value ?? string.Empty).TrimStart('?'),
            _signingKey,
            TimeProvider.System.GetUtcNow()))
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            context.Response.Headers.CacheControl = "no-store";
            return;
        }

        await _next(context);
    }

    public static bool IsLocalHealthProbe(HttpContext context) =>
        context.Request.Path == "/health" &&
        !context.Request.Headers.ContainsKey("X-Forwarded-For");

    public static bool IsStripeWebhook(HttpContext context) =>
        HttpMethods.IsPost(context.Request.Method) &&
        context.Request.Path == "/api/billing/webhook";

    public static bool IsValidSignature(
        string? supplied,
        string method,
        string path,
        string queryString,
        string signingKey,
        DateTimeOffset now)
    {
        if (string.IsNullOrWhiteSpace(supplied) || Encoding.UTF8.GetByteCount(signingKey) < 32)
        {
            return false;
        }

        var parts = supplied.Split('.', StringSplitOptions.None);
        if (parts.Length != 2 || !long.TryParse(parts[0], NumberStyles.None, CultureInfo.InvariantCulture, out var timestamp))
        {
            return false;
        }

        var ageSeconds = now.ToUnixTimeSeconds() - timestamp;
        if (ageSeconds is < -30 or > 60) return false;

        byte[] suppliedSignature;
        try
        {
            var base64 = parts[1].Replace('-', '+').Replace('_', '/');
            base64 = base64.PadRight(base64.Length + ((4 - base64.Length % 4) % 4), '=');
            suppliedSignature = Convert.FromBase64String(base64);
        }
        catch (FormatException)
        {
            return false;
        }

        if (suppliedSignature.Length != 32) return false;
        var canonical = $"{parts[0]}\n{method}\n{path}\n{queryString}";
        var expected = HMACSHA256.HashData(Encoding.UTF8.GetBytes(signingKey), Encoding.UTF8.GetBytes(canonical));
        return CryptographicOperations.FixedTimeEquals(expected, suppliedSignature);
    }
}
