namespace RecruiterReply.Models;

public enum SubscriptionEconomicsFactType { ContractStarted, ContractEnded, InvoicePaid, Refund, AiCost }

public sealed record SubscriptionEconomicsFact(
    string EventId, string ObjectId, string SubscriptionId, SubscriptionEconomicsFactType Type,
    DateTimeOffset OccurredAt, string Environment, string Plan, string Currency,
    long? AmountMinor = null, long? ContractedMonthlyAmountMinor = null);

public sealed record SubscriptionEconomicsPeriod(
    DateTimeOffset StartUtc, DateTimeOffset EndUtc, string Environment);

public sealed record CurrencyEconomics(
    string Currency, long? CashCollectedMinor, long? RefundsMinor,
    long? AiCostMinor, long? ContributionMinor);

public sealed record SubscriptionEconomicsReport(
    DateTimeOffset PeriodStartUtc,
    DateTimeOffset PeriodEndUtc,
    string Environment,
    long? ContractedMrrMinor,
    long? ContractedArrMinor,
    int? PaidActive,
    IReadOnlyList<CurrencyEconomics> Currencies,
    DateTimeOffset? DataFreshnessUtc,
    IReadOnlyList<string> Warnings);
