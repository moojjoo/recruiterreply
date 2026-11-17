using RecruiterReply.Models;
using RecruiterReply.Services;

namespace RecruiterReply.Tests.Services;

public class SubscriptionEconomicsComparisonBuilderTests
{
    private static readonly DateTimeOffset Start = new(2026, 10, 1, 0, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset End = new(2026, 11, 1, 0, 0, 0, TimeSpan.Zero);

    [Fact]
    public void Build_ComparesEqualPeriodsAndReportsCurrencyTrends()
    {
        var facts = new[]
        {
            Fact("evt_contract", "sub_1", SubscriptionEconomicsFactType.ContractStarted, Start.AddMonths(-1), contractedMonthly: 1900),
            Fact("evt_prior_cash", "in_prior", SubscriptionEconomicsFactType.InvoicePaid, Start.AddDays(-5), 1000),
            Fact("evt_prior_refund", "re_prior", SubscriptionEconomicsFactType.Refund, Start.AddDays(-4), 100),
            Fact("evt_prior_cost", "cost_prior", SubscriptionEconomicsFactType.AiCost, Start.AddDays(-3), 100),
            Fact("evt_current_cash", "in_current", SubscriptionEconomicsFactType.InvoicePaid, Start.AddDays(25), 1500),
            Fact("evt_current_refund", "re_current", SubscriptionEconomicsFactType.Refund, Start.AddDays(26), 100),
            Fact("evt_current_cost", "cost_current", SubscriptionEconomicsFactType.AiCost, Start.AddDays(30), 200)
        };

        var comparison = SubscriptionEconomicsComparisonBuilder.Build(facts, new(Start, End, "test"), TimeSpan.FromDays(2));
        var usd = Assert.Single(comparison.Currencies);

        Assert.Equal(Start - (End - Start), comparison.Prior.PeriodStartUtc);
        Assert.Equal(Start, comparison.Prior.PeriodEndUtc);
        Assert.Equal(500, usd.CashCollected.AbsoluteChange);
        Assert.Equal(50m, usd.CashCollected.PercentChange);
        Assert.Equal(400, usd.Contribution.AbsoluteChange);
        Assert.Equal(EconomicsFreshnessStatus.Fresh, comparison.FreshnessStatus);
        Assert.Equal(TimeSpan.FromDays(1), comparison.DataAge);
    }

    [Fact]
    public void Build_ZeroBaselineHasAbsoluteChangeButNoInventedPercent()
    {
        var facts = new[]
        {
            Fact("evt_contract_0", "sub_0", SubscriptionEconomicsFactType.ContractStarted, Start.AddMonths(-1), contractedMonthly: 0),
            Fact("evt_contract_1", "sub_1", SubscriptionEconomicsFactType.ContractStarted, Start.AddDays(1), contractedMonthly: 1900)
        };

        var comparison = SubscriptionEconomicsComparisonBuilder.Build(facts, new(Start, End, "test"), TimeSpan.FromDays(31));

        Assert.Equal(1900, comparison.ContractedMrr.AbsoluteChange);
        Assert.Null(comparison.ContractedMrr.PercentChange);
        Assert.Contains("TREND_BASELINE_ZERO:CONTRACTED_MRR", comparison.Warnings);
    }

    [Fact]
    public void Build_MissingPeriodDataKeepsTrendUnknown()
    {
        var facts = new[]
        {
            Fact("evt_cash", "in_current", SubscriptionEconomicsFactType.InvoicePaid, Start.AddDays(2), 1900)
        };

        var comparison = SubscriptionEconomicsComparisonBuilder.Build(facts, new(Start, End, "test"), TimeSpan.FromDays(1));
        var usd = Assert.Single(comparison.Currencies);

        Assert.Null(usd.CashCollected.Prior);
        Assert.Null(usd.CashCollected.AbsoluteChange);
        Assert.Null(usd.CashCollected.PercentChange);
        Assert.Contains("TREND_DATA_UNAVAILABLE:CASH:USD", comparison.Warnings);
        Assert.Equal(EconomicsFreshnessStatus.Stale, comparison.FreshnessStatus);
        Assert.Contains("DATA_STALE", comparison.Warnings);
    }

    [Fact]
    public void Build_OnlyPriorFactsReportsStaleFreshness()
    {
        var facts = new[]
        {
            Fact("evt_prior", "in_prior", SubscriptionEconomicsFactType.InvoicePaid, Start.AddDays(-1), 1900)
        };

        var comparison = SubscriptionEconomicsComparisonBuilder.Build(facts, new(Start, End, "test"), TimeSpan.FromDays(1));

        Assert.Equal(EconomicsFreshnessStatus.Stale, comparison.FreshnessStatus);
        Assert.Equal(TimeSpan.FromDays(32), comparison.DataAge);
        Assert.Contains("DATA_STALE", comparison.Warnings);
    }

    [Fact]
    public void Build_FutureFactCannotMakeCurrentReportFresh()
    {
        var facts = new[]
        {
            Fact("evt_future", "in_future", SubscriptionEconomicsFactType.InvoicePaid, End.AddDays(1), 1900)
        };

        var comparison = SubscriptionEconomicsComparisonBuilder.Build(facts, new(Start, End, "test"), TimeSpan.FromDays(1));

        Assert.Null(comparison.Current.DataFreshnessUtc);
        Assert.Equal(EconomicsFreshnessStatus.Unknown, comparison.FreshnessStatus);
    }

    private static SubscriptionEconomicsFact Fact(
        string eventId,
        string objectId,
        SubscriptionEconomicsFactType type,
        DateTimeOffset at,
        long? amount = null,
        long? contractedMonthly = null) =>
        new(eventId, objectId, "sub_1", type, at, "test", "professional", "usd", amount, contractedMonthly);
}
