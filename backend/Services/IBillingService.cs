using RecruiterReply.Models;

namespace RecruiterReply.Services;

public interface IBillingService
{
    Task<string> CreateCheckoutSessionAsync(Guid userId, string tier, string interval = BillingIntervals.Month, CancellationToken cancellationToken = default);
    Task<string?> UpgradeToRecruiterProAsync(Guid userId, string interval = BillingIntervals.Month, CancellationToken cancellationToken = default);
    Task<string> CreatePortalSessionAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<BillingPlanCatalogResponse> GetPlanCatalogAsync(CancellationToken cancellationToken = default);
    Task CancelSubscriptionAsync(Guid userId, CancellationToken cancellationToken = default);
    Task HandleWebhookAsync(string json, string stripeSignatureHeader, CancellationToken cancellationToken = default);
}
