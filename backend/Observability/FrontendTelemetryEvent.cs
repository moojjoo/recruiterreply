using System.Text.RegularExpressions;

namespace RecruiterReply.Observability;

public sealed record FrontendTelemetryEvent(
    string EventName,
    string Severity,
    string? TraceId,
    string? Route,
    Dictionary<string, string>? Metadata);

public static partial class FrontendTelemetryValidation
{
    private static readonly HashSet<string> AllowedMetadata = new(StringComparer.OrdinalIgnoreCase)
    {
        "component", "source", "statusCode", "errorType", "operation", "routeTemplate",
        "durationMs", "browser", "release"
    };

    [GeneratedRegex("^[a-zA-Z0-9_.:-]{1,80}$")]
    private static partial Regex SafeValueRegex();

    public static bool TryNormalize(FrontendTelemetryEvent input, out FrontendTelemetryEvent normalized)
    {
        normalized = input;
        if (input is null || !SafeValueRegex().IsMatch(input.EventName) ||
            !input.Severity.Equals("Warning", StringComparison.OrdinalIgnoreCase) &&
            !input.Severity.Equals("Error", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        var metadata = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (input.Metadata is not null)
        {
            foreach (var pair in input.Metadata.Take(12))
            {
                if (!AllowedMetadata.Contains(pair.Key) || string.IsNullOrWhiteSpace(pair.Value) ||
                    pair.Value.Length > 160 || !SafeValueRegex().IsMatch(pair.Value))
                {
                    return false;
                }

                metadata[pair.Key] = pair.Value;
            }
        }

        var traceId = string.IsNullOrWhiteSpace(input.TraceId) ? null : input.TraceId.Trim();
        if (traceId is not null && (traceId.Length > 64 || !SafeValueRegex().IsMatch(traceId))) return false;
        var route = string.IsNullOrWhiteSpace(input.Route) ? null : input.Route.Trim();
        if (route is not null && (route.Length > 120 || route.Contains('?', StringComparison.Ordinal))) return false;

        normalized = new FrontendTelemetryEvent(input.EventName, input.Severity, traceId, route, metadata);
        return true;
    }
}
