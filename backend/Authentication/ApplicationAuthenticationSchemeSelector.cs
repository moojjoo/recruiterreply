using Microsoft.AspNetCore.Authentication.JwtBearer;

namespace RecruiterReply.Authentication;

public static class ApplicationAuthenticationSchemeSelector
{
    public static string Select(HttpContext context, bool legacyAuthEnabled, bool cognitoBffEnabled)
    {
        ArgumentNullException.ThrowIfNull(context);

        // Explicit legacy bearer authentication remains available only when the
        // deployment has deliberately enabled legacy authentication.
        var hasBearerToken = legacyAuthEnabled && context.Request.Headers.Authorization.Any(value =>
            value is not null && value.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase));
        if (hasBearerToken) return JwtBearerDefaults.AuthenticationScheme;

        // In BFF mode, only the application BFF cookie may establish an
        // application principal. The independent perimeter rr_session grants
        // access to the site but must never provision or authenticate an app user.
        if (cognitoBffEnabled) return BffSessionAuthenticationHandler.SchemeName;

        // Edge-session application identity is retained only for deployments
        // that explicitly enable legacy auth and have not enabled BFF mode.
        if (legacyAuthEnabled && context.Request.Cookies.ContainsKey("rr_session")) return "EdgeSession";
        return legacyAuthEnabled
            ? JwtBearerDefaults.AuthenticationScheme
            : BffSessionAuthenticationHandler.SchemeName;
    }
}
