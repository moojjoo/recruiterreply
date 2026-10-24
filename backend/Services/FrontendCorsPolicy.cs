using Microsoft.AspNetCore.Cors.Infrastructure;
using Microsoft.Extensions.Configuration;

namespace RecruiterReply.Services;

public static class FrontendCorsPolicy
{
    private static readonly string[] LocalOrigins =
        ["http://localhost:3000", "http://localhost:5173"];

    public static CorsPolicy Create(IConfiguration configuration, bool isDevelopment)
    {
        var allowedOrigins = configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
            ?? LocalOrigins;
        var policy = new CorsPolicyBuilder();

        if (isDevelopment)
        {
            // Vite may bind a different port or be opened via 127.0.0.1.
            // Configured origins still apply: the hosted dev env runs as Development.
            policy.SetIsOriginAllowed(origin =>
                allowedOrigins.Contains(origin, StringComparer.OrdinalIgnoreCase)
                || (Uri.TryCreate(origin, UriKind.Absolute, out var uri) && uri.IsLoopback));
        }
        else
        {
            policy.WithOrigins(allowedOrigins);
        }

        // Browser API clients intentionally send credentials for cookie-auth.
        // Without this, the browser hides even successful registration and
        // Google-login responses. Origins remain restricted above; no wildcard
        // origin is compatible with credentialed CORS.
        return policy.AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials()
            .Build();
    }
}
