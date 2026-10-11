using RecruiterReply.Services;

namespace RecruiterReply.Tests.Services;

public class PaidInvoiceRulesTests
{
    [Fact]
    public void PaidSubscriptionInvoice_IsEligible() =>
        Assert.True(PaidInvoiceRules.IsEligible("in_123", "paid", 2900, "usd", true));

    [Fact]
    public void ZeroDollarTrial_IsNotEligible() =>
        Assert.False(PaidInvoiceRules.IsEligible("in_trial", "paid", 0, "usd", true));

    [Fact]
    public void OpenInvoice_IsNotEligible() =>
        Assert.False(PaidInvoiceRules.IsEligible("in_unpaid", "open", 2900, "usd", true));

    [Fact]
    public void OneOffInvoice_IsNotEligible() =>
        Assert.False(PaidInvoiceRules.IsEligible("in_once", "paid", 2900, "usd", false));
}
