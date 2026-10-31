using Microsoft.Extensions.Configuration;
using RecruiterReply.Services;

namespace RecruiterReply.Tests.Services;

public class FrontendCorsPolicyTests
{
    [Fact]
    public void Create_HostedPolicy_AllowsCredentialsOnlyForConfiguredOrigin()
    {
        var configuration = ConfigurationWithOrigin("https://recruiterreply.com");

        var policy = FrontendCorsPolicy.Create(configuration, isDevelopment: false);

        Assert.True(policy.SupportsCredentials);
        Assert.True(policy.IsOriginAllowed("https://recruiterreply.com"));
        Assert.False(policy.IsOriginAllowed("https://attacker.example"));
        Assert.DoesNotContain("*", policy.Origins);
    }

    [Fact]
    public void Create_DevelopmentPolicy_AllowsLoopbackButRejectsUntrustedHosts()
    {
        var configuration = ConfigurationWithOrigin("https://dev.recruiterreply.com");

        var policy = FrontendCorsPolicy.Create(configuration, isDevelopment: true);

        Assert.True(policy.SupportsCredentials);
        Assert.True(policy.IsOriginAllowed("https://dev.recruiterreply.com"));
        Assert.True(policy.IsOriginAllowed("http://127.0.0.1:5173"));
        Assert.False(policy.IsOriginAllowed("https://attacker.example"));
    }

    private static IConfiguration ConfigurationWithOrigin(string origin) =>
        new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Cors:AllowedOrigins:0"] = origin,
        }).Build();
}
