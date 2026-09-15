namespace RecruiterReply.Models;

public static class PlanTiers
{
    public const string Free = "free";
    public const string Professional = "professional";
    public const string RecruiterPro = "recruiter_pro";
}

public static class UsageFeatures
{
    public const string Analyze = "analyze";
    public const string Reply = "reply";
    public const string Compare = "compare";
}

public static class PlanLimits
{
    // null = unlimited
    private static readonly Dictionary<string, Dictionary<string, int?>> Limits = new()
    {
        [PlanTiers.Free] = new()
        {
            [UsageFeatures.Analyze] = 5,
            [UsageFeatures.Reply] = 5,
            [UsageFeatures.Compare] = 2,
        },
        [PlanTiers.Professional] = new()
        {
            [UsageFeatures.Analyze] = 200,
            [UsageFeatures.Reply] = 200,
            [UsageFeatures.Compare] = 50,
        },
        [PlanTiers.RecruiterPro] = new()
        {
            [UsageFeatures.Analyze] = null,
            [UsageFeatures.Reply] = null,
            [UsageFeatures.Compare] = null,
        },
    };

    public static int? GetLimit(string tier, string feature)
    {
        if (!Limits.TryGetValue(tier, out var featureLimits))
        {
            featureLimits = Limits[PlanTiers.Free];
        }

        return featureLimits.TryGetValue(feature, out var limit) ? limit : null;
    }
}

public class CheckoutSessionRequest
{
    public string Tier { get; set; } = string.Empty;
}

public class CheckoutSessionResponse
{
    public string Url { get; set; } = string.Empty;
}

public class PortalSessionResponse
{
    public string Url { get; set; } = string.Empty;
}

public class FeatureUsageStatus
{
    public string Feature { get; set; } = string.Empty;
    public int Used { get; set; }
    public int? Limit { get; set; }
}

public class UsageStatusResponse
{
    public string SubscriptionTier { get; set; } = string.Empty;
    public string? SubscriptionStatus { get; set; }
    public DateTime? SubscriptionCurrentPeriodEnd { get; set; }
    public List<FeatureUsageStatus> Usage { get; set; } = new();
}
