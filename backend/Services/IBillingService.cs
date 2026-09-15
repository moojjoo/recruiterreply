namespace RecruiterReply.Services;

public interface IBillingService
{
    Task<string> CreateCheckoutSessionAsync(Guid userId, string tier, CancellationToken cancellationToken = default);
    Task<string> CreatePortalSessionAsync(Guid userId, CancellationToken cancellationToken = default);
    Task HandleWebhookAsync(string json, string stripeSignatureHeader, CancellationToken cancellationToken = default);
}
