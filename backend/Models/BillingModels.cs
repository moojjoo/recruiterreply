namespace RecruiterReply.Models;

public static class PlanTiers
{
    public const string Free = "free";
    public const string Professional = "professional";
    public const string RecruiterPro = "recruiter_pro";
}

public static class BillingIntervals
{
    public const string Month = "month";
    public const string Year = "year";

    public static bool IsSupported(string interval) => interval is Month or Year;
}

public static class UsageFeatures
{
    public const string Analyze = "analyze";
    public const string Reply = "reply";
    public const string Compare = "compare";
    public const string AutoTriage = "auto_triage";
}

public static class PlanLimits
{
    // null = unlimited
    private static readonly Dictionary<string, Dictionary<string, int?>> Limits = new()
    {
        [PlanTiers.Free] = new()
        {
            [UsageFeatures.Analyze] = 3,
            [UsageFeatures.Reply] = 3,
            [UsageFeatures.Compare] = 1,
            [UsageFeatures.AutoTriage] = 0,
        },
        [PlanTiers.Professional] = new()
        {
            [UsageFeatures.Analyze] = 200,
            [UsageFeatures.Reply] = 200,
            [UsageFeatures.Compare] = 50,
            [UsageFeatures.AutoTriage] = 500,
        },
        [PlanTiers.RecruiterPro] = new()
        {
            [UsageFeatures.Analyze] = 500,
            [UsageFeatures.Reply] = 500,
            [UsageFeatures.Compare] = 100,
            [UsageFeatures.AutoTriage] = 5000,
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
    public string Interval { get; set; } = BillingIntervals.Month;
}

public class CheckoutSessionResponse
{
    public string Url { get; set; } = string.Empty;
}

public class BillingPlanCatalogResponse
{
    public List<BillingPlanResponse> Plans { get; set; } = new();
}

public class BillingPlanResponse
{
    public string Tier { get; set; } = string.Empty;
    public string Interval { get; set; } = BillingIntervals.Month;
    public long? UnitAmount { get; set; }
    public string Currency { get; set; } = "usd";
    public long? IntervalCount { get; set; }
    public int TrialPeriodDays { get; set; }
}

public class UpgradeToRecruiterProRequest
{
    public string Interval { get; set; } = BillingIntervals.Month;
}

public class UpgradeToRecruiterProResponse
{
    public string Status { get; set; } = string.Empty;
    public string Tier { get; set; } = string.Empty;
    public string? Url { get; set; }
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
    public Guid? SubscriptionCancellationEventId { get; set; }
    public bool SubscriptionCancelAtPeriodEnd { get; set; }
    public List<FeatureUsageStatus> Usage { get; set; } = new();
}
