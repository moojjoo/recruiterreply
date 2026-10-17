using Microsoft.Extensions.Configuration;
using RecruiterReply.Services;

namespace RecruiterReply.Tests.Services;

public class StripeEnvironmentGuardTests
{
    private static IConfiguration Config(string? key) =>
        new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Stripe:SecretKey"] = key,
            ["Stripe:WebhookSecret"] = "whsec_placeholder",
            ["Stripe:PriceId:Professional"] = "price_placeholder"
        }).Build();

    [Theory]
    [InlineData("Development", "sk_live_fake")]
    [InlineData("Staging", "rk_live_fake")]
    [InlineData("Production", "sk_test_fake")]
    [InlineData("Production", null)]
    [InlineData("Development", null)]
    public void Validate_RejectsWrongOrMissingMode(string environment, string? key) =>
        Assert.Throws<InvalidOperationException>(() => StripeEnvironmentGuard.Validate(Config(key), environment, true));

    [Theory]
    [InlineData("Development", "sk_test_fake")]
    [InlineData("Staging", "rk_test_fake")]
    [InlineData("Production", "sk_live_fake")]
    public void Validate_AcceptsMatchingMode(string environment, string key) =>
        StripeEnvironmentGuard.Validate(Config(key), environment, true);

    [Theory]
    [InlineData("Development", true)]
    [InlineData("Staging", true)]
    [InlineData("Production", false)]
    public void Webhook_RejectsWrongMode(string environment, bool liveMode) =>
        Assert.Throws<InvalidOperationException>(() => StripeEnvironmentGuard.ValidateWebhookMode(liveMode, environment));
}
