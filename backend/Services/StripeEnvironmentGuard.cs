using Microsoft.Extensions.Configuration;

namespace RecruiterReply.Services;

public static class StripeEnvironmentGuard
{
    public static void Validate(IConfiguration config, string environment, bool deployed)
    {
        if (!deployed) return;

        bool expectedLive = environment switch
        {
            "Production" => true,
            "Development" or "Staging" => false,
            _ => throw new InvalidOperationException("Unrecognized Stripe deployment environment.")
        };

        string? key = config["Stripe:SecretKey"];
        bool? actualLive = key switch
        {
            not null when key.StartsWith("sk_live_", StringComparison.Ordinal) || key.StartsWith("rk_live_", StringComparison.Ordinal) => true,
            not null when key.StartsWith("sk_test_", StringComparison.Ordinal) || key.StartsWith("rk_test_", StringComparison.Ordinal) => false,
            _ => null
        };
        if (actualLive is null || actualLive != expectedLive)
            throw new InvalidOperationException("Stripe API key mode does not match deployment environment.");

        if (string.IsNullOrWhiteSpace(config["Stripe:WebhookSecret"]))
            throw new InvalidOperationException("Stripe webhook signing secret is missing.");
        if (string.IsNullOrWhiteSpace(config["Stripe:PriceId:Professional"]))
            throw new InvalidOperationException("Stripe Professional price is missing.");
    }

    public static void ValidateWebhookMode(bool liveMode, string environment)
    {
        bool expectedLive = environment switch
        {
            "Production" => true,
            "Development" or "Staging" => false,
            _ => throw new InvalidOperationException("Unrecognized Stripe webhook environment.")
        };
        if (liveMode != expectedLive)
            throw new InvalidOperationException("Stripe webhook mode does not match deployment environment.");
    }
}
