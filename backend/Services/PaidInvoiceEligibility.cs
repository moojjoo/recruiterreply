using Stripe;

namespace RecruiterReply.Services;

/// <summary>
/// A paid subscription invoice is not the same as a trial checkout.
/// This predicate deliberately does not send analytics or persist conversion events.
/// A durable, unique invoice ledger and consent-safe attribution are required first.
/// </summary>
public static class PaidInvoiceEligibility
{
    public static bool IsPaidSubscriptionInvoice(Invoice? invoice)
    {
        if (invoice is null) return false;
        if (!string.Equals(invoice.Status, "paid", StringComparison.OrdinalIgnoreCase)) return false;
        if (invoice.AmountPaid <= 0) return false;
        if (string.IsNullOrWhiteSpace(invoice.Currency)) return false;
        if (string.IsNullOrWhiteSpace(invoice.Id)) return false;
        // Do not count a one-off invoice as a subscription purchase.
        if (invoice.Parent?.SubscriptionDetails is null) return false;
        return true;
    }
}
