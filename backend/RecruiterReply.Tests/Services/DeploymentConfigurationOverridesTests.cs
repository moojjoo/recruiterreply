using Microsoft.Extensions.Configuration;
using RecruiterReply.Services;

namespace RecruiterReply.Tests.Services;

public class DeploymentConfigurationOverridesTests
{
    [Fact]
    public void ApplyLegacyAuth_ExplicitTrueOverridesStaleSecretValue()
    {
        var configuration = ConfigurationWithLegacyAuth("false");

        DeploymentConfigurationOverrides.ApplyLegacyAuth(configuration, "true");

        Assert.True(configuration.GetValue<bool>("LegacyAuth:Enabled"));
    }

    [Fact]
    public void ApplyLegacyAuth_MissingValuePreservesConfiguredValue()
    {
        var configuration = ConfigurationWithLegacyAuth("false");

        DeploymentConfigurationOverrides.ApplyLegacyAuth(configuration, null);

        Assert.False(configuration.GetValue<bool>("LegacyAuth:Enabled"));
    }

    [Fact]
    public void ApplyLegacyAuth_InvalidValueFailsStartupClearly()
    {
        var configuration = ConfigurationWithLegacyAuth("false");

        var exception = Assert.Throws<InvalidOperationException>(() =>
            DeploymentConfigurationOverrides.ApplyLegacyAuth(configuration, "enabled"));

        Assert.Contains("LEGACY_AUTH_ENABLED", exception.Message);
    }

    private static ConfigurationManager ConfigurationWithLegacyAuth(string value)
    {
        var configuration = new ConfigurationManager();
        configuration.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["LegacyAuth:Enabled"] = value,
        });
        return configuration;
    }
}
