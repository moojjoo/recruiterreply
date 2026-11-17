using RecruiterReply.Models;
using RecruiterReply.Services;

namespace RecruiterReply.Tests.Services;

public class SubscriptionEconomicsReportBuilderTests
{
    private static readonly DateTimeOffset Start = new(2026, 10, 1, 0, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset End = new(2026, 11, 1, 0, 0, 0, TimeSpan.Zero);

    [Fact]
    public void Build_DeduplicatesAndDoesNotTreatAnnualCashAsMrr()
    {
        var facts = new[]
        {
            Fact("evt_paid", "in_annual", "sub_1", SubscriptionEconomicsFactType.InvoicePaid, 29000, at: Start.AddDays(8)),
            Fact("evt_contract", "sub_1", "sub_1", SubscriptionEconomicsFactType.ContractStarted, contractedMonthly: 2417),
            Fact("evt_paid", "in_annual", "sub_1", SubscriptionEconomicsFactType.InvoicePaid, 29000, at: Start.AddDays(8)),
            Fact("evt_refund", "re_1", "sub_1", SubscriptionEconomicsFactType.Refund, 1000),
            Fact("evt_cost", "cost_1", "sub_1", SubscriptionEconomicsFactType.AiCost, 417)
        };
        var report = SubscriptionEconomicsReportBuilder.Build(facts, new(Start, End, "test"));
        Assert.Equal(2417, report.ContractedMrrMinor);
        Assert.Equal(29004, report.ContractedArrMinor);
        Assert.Equal(29000, Assert.Single(report.Currencies).CashCollectedMinor);
        Assert.Equal(27583, report.Currencies[0].ContributionMinor);
        Assert.Contains("DUPLICATE_EVENT_IGNORED", report.Warnings);
    }

    [Fact]
    public void Build_LatestContractStateWinsWhenDeliveryIsOutOfOrder()
    {
        var facts = new[]
        {
            Fact("evt_end", "sub_1", "sub_1", SubscriptionEconomicsFactType.ContractEnded, at: Start.AddDays(20)),
            Fact("evt_start", "sub_1", "sub_1", SubscriptionEconomicsFactType.ContractStarted, contractedMonthly: 1900)
        };
        var report = SubscriptionEconomicsReportBuilder.Build(facts, new(Start, End, "test"));
        Assert.Equal(0, report.PaidActive);
        Assert.Equal(0, report.ContractedMrrMinor);
    }

    [Fact]
    public void Build_MissingInputsRemainUnknownAndWarn()
    {
        var report = SubscriptionEconomicsReportBuilder.Build(
            new[] { Fact("evt_paid", "in_1", "sub_1", SubscriptionEconomicsFactType.InvoicePaid, 1900) },
            new(Start, End, "test"));
        var usd = Assert.Single(report.Currencies);
        Assert.Null(report.ContractedMrrMinor);
        Assert.Null(usd.RefundsMinor);
        Assert.Null(usd.AiCostMinor);
        Assert.Null(usd.ContributionMinor);
        Assert.Contains("CONTRACT_STATE_UNAVAILABLE", report.Warnings);
        Assert.Contains("REFUND_DATA_UNAVAILABLE:USD", report.Warnings);
        Assert.Contains("AI_COST_DATA_UNAVAILABLE:USD", report.Warnings);
    }

    [Fact]
    public void Build_PartialCashInputRemainsUnknown()
    {
        var report = SubscriptionEconomicsReportBuilder.Build(
            new[] { Fact("evt_paid", "in_1", "sub_1", SubscriptionEconomicsFactType.InvoicePaid) },
            new(Start, End, "test"));
        var usd = Assert.Single(report.Currencies);
        Assert.Null(usd.CashCollectedMinor);
        Assert.Null(usd.ContributionMinor);
        Assert.Contains("CASH_DATA_INCOMPLETE:USD", report.Warnings);
    }

    [Fact]
    public void Build_SeparatesCurrenciesAndEnvironments()
    {
        var facts = new[]
        {
            Fact("evt_usd", "in_usd", "sub_1", SubscriptionEconomicsFactType.InvoicePaid, 1900),
            Fact("evt_eur", "in_eur", "sub_2", SubscriptionEconomicsFactType.InvoicePaid, 1700, "eur"),
            Fact("evt_prod", "in_prod", "sub_3", SubscriptionEconomicsFactType.InvoicePaid, 9900, environment: "prod")
        };
        var report = SubscriptionEconomicsReportBuilder.Build(facts, new(Start, End, "test"));
        Assert.Equal(new[] { "EUR", "USD" }, report.Currencies.Select(c => c.Currency));
        Assert.Contains("MULTIPLE_CURRENCIES_REPORTED_SEPARATELY", report.Warnings);
    }

    private static SubscriptionEconomicsFact Fact(string eventId, string objectId, string subscriptionId,
        SubscriptionEconomicsFactType type, long? amount = null, string currency = "usd",
        long? contractedMonthly = null, DateTimeOffset? at = null, string environment = "test") =>
        new(eventId, objectId, subscriptionId, type, at ?? Start.AddDays(1), environment,
            "professional", currency, amount, contractedMonthly);
}
