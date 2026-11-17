using RecruiterReply.Models;

namespace RecruiterReply.Services;

public static class SubscriptionEconomicsComparisonBuilder
{
    public static SubscriptionEconomicsComparison Build(
        IEnumerable<SubscriptionEconomicsFact> facts,
        SubscriptionEconomicsPeriod currentPeriod,
        TimeSpan freshnessThreshold)
    {
        ArgumentNullException.ThrowIfNull(facts);
        if (freshnessThreshold < TimeSpan.Zero)
            throw new ArgumentOutOfRangeException(nameof(freshnessThreshold), "Freshness threshold cannot be negative.");

        var snapshot = facts.ToList();
        var duration = currentPeriod.EndUtc - currentPeriod.StartUtc;
        var priorPeriod = new SubscriptionEconomicsPeriod(
            currentPeriod.StartUtc - duration,
            currentPeriod.StartUtc,
            currentPeriod.Environment);
        var current = SubscriptionEconomicsReportBuilder.Build(snapshot, currentPeriod);
        var prior = SubscriptionEconomicsReportBuilder.Build(snapshot, priorPeriod);
        var warnings = current.Warnings.Concat(prior.Warnings).ToList();

        var mrr = Trend(current.ContractedMrrMinor, prior.ContractedMrrMinor, "CONTRACTED_MRR", warnings);
        var arr = Trend(current.ContractedArrMinor, prior.ContractedArrMinor, "CONTRACTED_ARR", warnings);
        var paid = Trend(current.PaidActive, prior.PaidActive, "PAID_ACTIVE", warnings);

        var currentCurrencies = current.Currencies.ToDictionary(value => value.Currency, StringComparer.Ordinal);
        var priorCurrencies = prior.Currencies.ToDictionary(value => value.Currency, StringComparer.Ordinal);
        var currencies = currentCurrencies.Keys.Concat(priorCurrencies.Keys)
            .Distinct(StringComparer.Ordinal)
            .Order(StringComparer.Ordinal)
            .Select(currency =>
            {
                currentCurrencies.TryGetValue(currency, out var currentValue);
                priorCurrencies.TryGetValue(currency, out var priorValue);
                return new CurrencyEconomicsTrend(
                    currency,
                    Trend(currentValue?.CashCollectedMinor, priorValue?.CashCollectedMinor, $"CASH:{currency}", warnings),
                    Trend(currentValue?.RefundsMinor, priorValue?.RefundsMinor, $"REFUNDS:{currency}", warnings),
                    Trend(currentValue?.AiCostMinor, priorValue?.AiCostMinor, $"AI_COST:{currency}", warnings),
                    Trend(currentValue?.ContributionMinor, priorValue?.ContributionMinor, $"CONTRIBUTION:{currency}", warnings));
            })
            .ToList();

        EconomicsFreshnessStatus freshnessStatus;
        TimeSpan? dataAge = null;
        if (current.DataFreshnessUtc is null)
        {
            freshnessStatus = EconomicsFreshnessStatus.Unknown;
            warnings.Add("DATA_FRESHNESS_UNKNOWN");
        }
        else
        {
            dataAge = currentPeriod.EndUtc - current.DataFreshnessUtc.Value;
            freshnessStatus = dataAge > freshnessThreshold
                ? EconomicsFreshnessStatus.Stale
                : EconomicsFreshnessStatus.Fresh;
            if (freshnessStatus == EconomicsFreshnessStatus.Stale)
                warnings.Add("DATA_STALE");
        }

        return new(
            current,
            prior,
            mrr,
            arr,
            paid,
            currencies,
            freshnessStatus,
            dataAge,
            freshnessThreshold,
            warnings.Distinct(StringComparer.Ordinal).Order(StringComparer.Ordinal).ToList());
    }

    private static EconomicsMetricTrend Trend(long? current, long? prior, string metric, ICollection<string> warnings)
    {
        if (!current.HasValue || !prior.HasValue)
        {
            warnings.Add($"TREND_DATA_UNAVAILABLE:{metric}");
            return new(current, prior, null, null);
        }

        var absoluteChange = checked(current.Value - prior.Value);
        if (prior.Value == 0)
        {
            warnings.Add($"TREND_BASELINE_ZERO:{metric}");
            return new(current, prior, absoluteChange, null);
        }

        var percentChange = decimal.Round(
            absoluteChange * 100m / prior.Value,
            2,
            MidpointRounding.AwayFromZero);
        return new(current, prior, absoluteChange, percentChange);
    }

    private static EconomicsMetricTrend Trend(int? current, int? prior, string metric, ICollection<string> warnings) =>
        Trend(current.HasValue ? (long?)current.Value : null, prior.HasValue ? (long?)prior.Value : null, metric, warnings);
}
