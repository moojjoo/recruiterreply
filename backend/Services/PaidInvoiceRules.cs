namespace RecruiterReply.Services;

public static class PaidInvoiceRules
{
    public static bool IsEligible(string? invoiceId, string? status, long amountPaid,
        string? currency, bool isSubscriptionInvoice) =>
        !string.IsNullOrWhiteSpace(invoiceId) &&
        string.Equals(status, "paid", StringComparison.OrdinalIgnoreCase) &&
        amountPaid > 0 &&
        !string.IsNullOrWhiteSpace(currency) &&
        isSubscriptionInvoice;
}
