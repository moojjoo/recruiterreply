namespace RecruiterReply.Models;

public enum EconomicsFreshnessStatus
{
    Fresh,
    Stale,
    Unknown
}

public sealed record EconomicsMetricTrend(
    long? Current,
    long? Prior,
    long? AbsoluteChange,
    decimal? PercentChange);

public sealed record CurrencyEconomicsTrend(
    string Currency,
    EconomicsMetricTrend CashCollected,
    EconomicsMetricTrend Refunds,
    EconomicsMetricTrend AiCost,
    EconomicsMetricTrend Contribution);

public sealed record SubscriptionEconomicsComparison(
    SubscriptionEconomicsReport Current,
    SubscriptionEconomicsReport Prior,
    EconomicsMetricTrend ContractedMrr,
    EconomicsMetricTrend ContractedArr,
    EconomicsMetricTrend PaidActive,
    IReadOnlyList<CurrencyEconomicsTrend> Currencies,
    EconomicsFreshnessStatus FreshnessStatus,
    TimeSpan? DataAge,
    TimeSpan FreshnessThreshold,
    IReadOnlyList<string> Warnings);
