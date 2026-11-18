using Microsoft.AspNetCore.Authentication;
using RecruiterReply.Authentication;

namespace RecruiterReply.Documentation;

public static class ProtectedApiDocumentation
{
    public const string RoutePrefix = "api/swagger";
    public const string DocumentRoute = "/api/swagger/v1/swagger.json";

    public static bool IsEnabled(IHostEnvironment environment, IConfiguration configuration) =>
        !environment.IsProduction()
        && (environment.IsDevelopment() || environment.IsStaging())
        && configuration.GetValue<bool>("Swagger:Enabled");

    public static void UseProtectedApiDocumentationGuard(this IApplicationBuilder app) =>
        app.UseMiddleware<ProtectedApiDocumentationMiddleware>();

    public static void UseProtectedApiDocumentation(this WebApplication app)
    {
        if (!IsEnabled(app.Environment, app.Configuration)) return;

        app.UseSwagger(options =>
        {
            options.RouteTemplate = RoutePrefix + "/{documentName}/swagger.json";
        });
        app.UseSwaggerUI(options =>
        {
            options.RoutePrefix = RoutePrefix;
            options.SwaggerEndpoint("./v1/swagger.json", "RecruiterReply API v1");
            // Documentation is intentionally read-only. Normal API clients keep
            // using the existing CSRF and authorization controls.
            options.SupportedSubmitMethods();
        });
    }
}

public sealed class ProtectedApiDocumentationMiddleware
{
    private readonly RequestDelegate _next;
    private readonly bool _enabled;
    private readonly bool _legacyAuthEnabled;
    private readonly bool _cognitoBffEnabled;

    public ProtectedApiDocumentationMiddleware(
        RequestDelegate next,
        IHostEnvironment environment,
        IConfiguration configuration)
    {
        _next = next;
        _enabled = ProtectedApiDocumentation.IsEnabled(environment, configuration);
        _legacyAuthEnabled = configuration.GetValue("LegacyAuth:Enabled", true);
        _cognitoBffEnabled = configuration.GetValue<bool>("CognitoBff:Enabled");
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (IsBlockedAlias(context.Request.Path))
        {
            Reject(context, StatusCodes.Status404NotFound);
            return;
        }

        if (!context.Request.Path.StartsWithSegments("/api/swagger"))
        {
            await _next(context);
            return;
        }

        if (!_enabled)
        {
            Reject(context, StatusCodes.Status404NotFound);
            return;
        }

        // The independent perimeter cookie is not an application session. In
        // legacy non-BFF mode the global Application selector deliberately
        // routes rr_session to EdgeSession, whose handler may provision an app
        // profile. Documentation must never invoke that side-effecting path.
        var selectedScheme = ApplicationAuthenticationSchemeSelector.Select(
            context, _legacyAuthEnabled, _cognitoBffEnabled);
        if (selectedScheme == "EdgeSession")
        {
            Reject(context, StatusCodes.Status401Unauthorized);
            return;
        }

        var authentication = await context.AuthenticateAsync(selectedScheme);
        if (!authentication.Succeeded || authentication.Principal?.Identity?.IsAuthenticated != true)
        {
            Reject(context, StatusCodes.Status401Unauthorized);
            return;
        }

        context.User = authentication.Principal;
        context.Response.OnStarting(() =>
        {
            context.Response.Headers.CacheControl = "no-store";
            return Task.CompletedTask;
        });
        await _next(context);
    }

    public static bool IsBlockedAlias(PathString path) =>
        path.StartsWithSegments("/swagger")
        || path.StartsWithSegments("/openapi")
        || path.StartsWithSegments("/api/openapi");

    private static void Reject(HttpContext context, int statusCode)
    {
        context.Response.StatusCode = statusCode;
        context.Response.Headers.CacheControl = "no-store";
    }
}
