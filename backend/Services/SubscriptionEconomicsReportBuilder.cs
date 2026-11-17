using RecruiterReply.Models;

namespace RecruiterReply.Services;

public static class SubscriptionEconomicsReportBuilder
{
    public static SubscriptionEconomicsReport Build(IEnumerable<SubscriptionEconomicsFact> facts, SubscriptionEconomicsPeriod period)
    {
        ArgumentNullException.ThrowIfNull(facts);
        if (period.StartUtc.Offset != TimeSpan.Zero || period.EndUtc.Offset != TimeSpan.Zero)
            throw new ArgumentException("Reporting periods must use UTC offsets.", nameof(period));
        if (period.StartUtc >= period.EndUtc)
            throw new ArgumentException("Reporting period start must precede end.", nameof(period));

        var warnings = new List<string>();
        var candidates = facts.Where(f => f.Environment == period.Environment).ToList();
        if (candidates.Any(f => f.OccurredAt.Offset != TimeSpan.Zero)) warnings.Add("NON_UTC_EVENT_EXCLUDED");
        candidates = candidates.Where(f => f.OccurredAt.Offset == TimeSpan.Zero)
            .OrderBy(f => f.OccurredAt).ThenBy(f => f.EventId, StringComparer.Ordinal).ToList();

        if (candidates.Count != candidates.DistinctBy(f => f.EventId, StringComparer.Ordinal).Count())
            warnings.Add("DUPLICATE_EVENT_IGNORED");
        candidates = candidates.DistinctBy(f => f.EventId, StringComparer.Ordinal).ToList();

        var duplicateObjects = candidates
            .Where(f => f.Type is SubscriptionEconomicsFactType.InvoicePaid or SubscriptionEconomicsFactType.Refund)
            .GroupBy(f => new { f.Type, f.ObjectId }).Where(g => g.Count() > 1)
            .SelectMany(g => g.Skip(1).Select(f => f.EventId)).ToHashSet(StringComparer.Ordinal);
        if (duplicateObjects.Count > 0) warnings.Add("DUPLICATE_BILLING_OBJECT_IGNORED");
        candidates = candidates.Where(f => !duplicateObjects.Contains(f.EventId)).ToList();

        var latestContracts = candidates
            .Where(f => f.Type is SubscriptionEconomicsFactType.ContractStarted or SubscriptionEconomicsFactType.ContractEnded)
            .Where(f => f.OccurredAt < period.EndUtc)
            .GroupBy(f => f.SubscriptionId, StringComparer.Ordinal)
            .Select(g => g.OrderByDescending(f => f.OccurredAt).ThenByDescending(f => f.EventId, StringComparer.Ordinal).First()).ToList();

        long? mrr = null;
        int? paidActive = null;
        if (latestContracts.Count == 0) warnings.Add("CONTRACT_STATE_UNAVAILABLE");
        else if (latestContracts.Any(f => f.Type == SubscriptionEconomicsFactType.ContractStarted && f.ContractedMonthlyAmountMinor is null))
            warnings.Add("CONTRACT_VALUE_INCOMPLETE");
        else
        {
            var active = latestContracts.Where(f => f.Type == SubscriptionEconomicsFactType.ContractStarted).ToList();
            mrr = active.Sum(f => f.ContractedMonthlyAmountMinor!.Value);
            paidActive = active.Count;
        }

        var periodFacts = candidates.Where(f => f.OccurredAt >= period.StartUtc && f.OccurredAt < period.EndUtc).ToList();
        var currencies = periodFacts
            .Where(f => f.Type is SubscriptionEconomicsFactType.InvoicePaid or SubscriptionEconomicsFactType.Refund or SubscriptionEconomicsFactType.AiCost)
            .Select(f => f.Currency.ToUpperInvariant()).Where(c => c.Length > 0).Distinct(StringComparer.Ordinal).Order(StringComparer.Ordinal)
            .Select(c => BuildCurrency(c, periodFacts, warnings)).ToList();
        if (currencies.Count > 1) warnings.Add("MULTIPLE_CURRENCIES_REPORTED_SEPARATELY");

        return new(period.StartUtc, period.EndUtc, period.Environment, mrr,
            mrr is null ? (long?)null : checked(mrr.Value * 12), paidActive, currencies,
            candidates.All(f => f.OccurredAt >= period.EndUtc) ? null : candidates.Where(f => f.OccurredAt < period.EndUtc).Max(f => f.OccurredAt),
            warnings.Distinct(StringComparer.Ordinal).Order(StringComparer.Ordinal).ToList());
    }

    private static CurrencyEconomics BuildCurrency(string currency, IReadOnlyList<SubscriptionEconomicsFact> facts, ICollection<string> warnings)
    {
        var relevant = facts.Where(f => f.Currency.Equals(currency, StringComparison.OrdinalIgnoreCase)).ToList();
        var invoices = relevant.Where(f => f.Type == SubscriptionEconomicsFactType.InvoicePaid).ToList();
        var refunds = relevant.Where(f => f.Type == SubscriptionEconomicsFactType.Refund).ToList();
        var costs = relevant.Where(f => f.Type == SubscriptionEconomicsFactType.AiCost).ToList();
        long? cash = invoices.All(f => f.AmountMinor.HasValue) ? invoices.Sum(f => f.AmountMinor!.Value) : null;
        if (invoices.Any(f => !f.AmountMinor.HasValue)) warnings.Add($"CASH_DATA_INCOMPLETE:{currency}");
        long? refundTotal = SumIfComplete(refunds, "REFUND", currency, warnings);
        long? costTotal = SumIfComplete(costs, "AI_COST", currency, warnings);
        long? contribution = cash.HasValue && refundTotal.HasValue && costTotal.HasValue
            ? cash.Value - refundTotal.Value - costTotal.Value : null;
        return new(currency, cash, refundTotal, costTotal, contribution);
    }

    private static long? SumIfComplete(IReadOnlyList<SubscriptionEconomicsFact> facts, string name, string currency, ICollection<string> warnings)
    {
        if (facts.Count == 0) { warnings.Add($"{name}_DATA_UNAVAILABLE:{currency}"); return null; }
        if (facts.Any(f => !f.AmountMinor.HasValue)) { warnings.Add($"{name}_DATA_INCOMPLETE:{currency}"); return null; }
        return facts.Sum(f => f.AmountMinor!.Value);
    }
}
