using Microsoft.Extensions.Configuration;

namespace RecruiterReply.Services;

public static class DeploymentConfigurationOverrides
{
    public static void ApplyLegacyAuth(IConfigurationManager configuration, string? configuredValue)
    {
        if (string.IsNullOrWhiteSpace(configuredValue))
        {
            return;
        }

        if (!bool.TryParse(configuredValue, out var enabled))
        {
            throw new InvalidOperationException("LEGACY_AUTH_ENABLED must be 'true' or 'false'.");
        }

        configuration.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["LegacyAuth:Enabled"] = enabled.ToString(),
        });
    }
}
