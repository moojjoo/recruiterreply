using RecruiterReply.Models;
using RecruiterReply.Repositories;
using Stripe;

namespace RecruiterReply.Services;

public class BillingService : IBillingService
{
    private const int TrialPeriodDays = 7;

    private readonly IUserRepository _userRepository;
    private readonly IConfiguration _configuration;
    private readonly ILogger<BillingService> _logger;
    private readonly IStripeClient? _stripeClient;

    public BillingService(IUserRepository userRepository, IConfiguration configuration, ILogger<BillingService> logger, IStripeClient? stripeClient = null)
    {
        _userRepository = userRepository;
        _configuration = configuration;
        _logger = logger;
        _stripeClient = stripeClient;
    }

    public async Task<string> CreateCheckoutSessionAsync(Guid userId, string tier, CancellationToken cancellationToken = default)
    {
        if (tier != PlanTiers.Professional && tier != PlanTiers.RecruiterPro)
        {
            throw new ArgumentException("Invalid subscription tier.");
        }

        var user = await _userRepository.GetByIdAsync(userId, cancellationToken)
            ?? throw new InvalidOperationException("User not found.");

        if (string.IsNullOrWhiteSpace(user.StripeCustomerId))
        {
            var customerService = _stripeClient is null ? new CustomerService() : new CustomerService(_stripeClient);
            var customer = await customerService.CreateAsync(new CustomerCreateOptions
            {
                Email = user.Email,
                Metadata = new Dictionary<string, string> { ["userId"] = user.Id.ToString() },
            }, cancellationToken: cancellationToken);

            user.StripeCustomerId = customer.Id;
            await _userRepository.UpdateAsync(user, cancellationToken);
        }

        var frontendBaseUrl = GetFrontendBaseUrl();
        var sessionService = _stripeClient is null ? new Stripe.Checkout.SessionService() : new Stripe.Checkout.SessionService(_stripeClient);
        var session = await sessionService.CreateAsync(new Stripe.Checkout.SessionCreateOptions
        {
            Mode = "subscription",
            Customer = user.StripeCustomerId,
            ClientReferenceId = userId.ToString(),
            LineItems = new List<Stripe.Checkout.SessionLineItemOptions>
            {
                new() { Price = GetPriceId(tier), Quantity = 1 },
            },
            SubscriptionData = new Stripe.Checkout.SessionSubscriptionDataOptions
            {
                TrialPeriodDays = TrialPeriodDays,
            },
            SuccessUrl = $"{frontendBaseUrl}/dashboard?checkout=success",
            CancelUrl = $"{frontendBaseUrl}/pricing?checkout=cancelled",
            Metadata = new Dictionary<string, string> { ["userId"] = userId.ToString(), ["tier"] = tier },
        }, cancellationToken: cancellationToken);

        return session.Url;
    }

    public async Task<string> CreatePortalSessionAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var user = await _userRepository.GetByIdAsync(userId, cancellationToken)
            ?? throw new InvalidOperationException("User not found.");

        if (string.IsNullOrWhiteSpace(user.StripeCustomerId))
        {
            throw new InvalidOperationException("No billing account found. Subscribe to a plan first.");
        }

        var portalService = _stripeClient is null ? new Stripe.BillingPortal.SessionService() : new Stripe.BillingPortal.SessionService(_stripeClient);
        var session = await portalService.CreateAsync(new Stripe.BillingPortal.SessionCreateOptions
        {
            Customer = user.StripeCustomerId,
            ReturnUrl = $"{GetFrontendBaseUrl()}/profile",
        }, cancellationToken: cancellationToken);

        return session.Url;
    }

    public async Task HandleWebhookAsync(string json, string stripeSignatureHeader, CancellationToken cancellationToken = default)
    {
        var webhookSecret = _configuration["Stripe:WebhookSecret"];
        if (string.IsNullOrWhiteSpace(webhookSecret))
        {
            throw new InvalidOperationException("Stripe webhook secret is not configured.");
        }

        var stripeEvent = EventUtility.ConstructEvent(json, stripeSignatureHeader, webhookSecret);

        switch (stripeEvent.Type)
        {
            case "checkout.session.completed":
                await HandleCheckoutSessionCompletedAsync(stripeEvent, cancellationToken);
                break;
            case "customer.subscription.updated":
                await HandleSubscriptionUpdatedAsync(stripeEvent, cancellationToken);
                break;
            case "customer.subscription.deleted":
                await HandleSubscriptionDeletedAsync(stripeEvent, cancellationToken);
                break;
            default:
                _logger.LogInformation("Unhandled Stripe webhook event type {EventType}", stripeEvent.Type);
                break;
        }
    }

    private async Task HandleCheckoutSessionCompletedAsync(Event stripeEvent, CancellationToken cancellationToken)
    {
        if (stripeEvent.Data.Object is not Stripe.Checkout.Session session)
        {
            return;
        }

        if (!Guid.TryParse(session.ClientReferenceId, out var userId))
        {
            _logger.LogWarning("Stripe checkout.session.completed missing a valid client_reference_id");
            return;
        }

        var user = await _userRepository.GetByIdAsync(userId, cancellationToken);
        if (user is null)
        {
            _logger.LogWarning("Stripe checkout.session.completed for unknown user {UserId}", userId);
            return;
        }

        var tier = session.Metadata is not null && session.Metadata.TryGetValue("tier", out var configuredTier)
            ? configuredTier
            : PlanTiers.Professional;

        user.StripeCustomerId = session.CustomerId;
        user.StripeSubscriptionId = session.SubscriptionId;
        user.SubscriptionTier = tier;

        if (!string.IsNullOrWhiteSpace(session.SubscriptionId))
        {
            var subscriptionService = _stripeClient is null ? new SubscriptionService() : new SubscriptionService(_stripeClient);
            var subscription = await subscriptionService.GetAsync(session.SubscriptionId, cancellationToken: cancellationToken);
            user.SubscriptionStatus = subscription.Status;
            user.SubscriptionCurrentPeriodEnd = subscription.CurrentPeriodEnd;
        }

        await _userRepository.UpdateAsync(user, cancellationToken);
    }

    private async Task HandleSubscriptionUpdatedAsync(Event stripeEvent, CancellationToken cancellationToken)
    {
        if (stripeEvent.Data.Object is not Subscription subscription)
        {
            return;
        }

        var user = await _userRepository.GetByStripeCustomerIdAsync(subscription.CustomerId, cancellationToken);
        if (user is null)
        {
            return;
        }

        user.StripeSubscriptionId = subscription.Id;
        user.SubscriptionStatus = subscription.Status;
        user.SubscriptionCurrentPeriodEnd = subscription.CurrentPeriodEnd;

        var priceId = subscription.Items?.Data?.FirstOrDefault()?.Price?.Id;
        var tier = ResolveTierFromPriceId(priceId);
        if (tier is not null)
        {
            user.SubscriptionTier = tier;
        }

        await _userRepository.UpdateAsync(user, cancellationToken);
    }

    private async Task HandleSubscriptionDeletedAsync(Event stripeEvent, CancellationToken cancellationToken)
    {
        if (stripeEvent.Data.Object is not Subscription subscription)
        {
            return;
        }

        var user = await _userRepository.GetByStripeCustomerIdAsync(subscription.CustomerId, cancellationToken);
        if (user is null)
        {
            return;
        }

        user.SubscriptionTier = PlanTiers.Free;
        user.SubscriptionStatus = "canceled";
        user.StripeSubscriptionId = null;
        user.SubscriptionCurrentPeriodEnd = null;

        await _userRepository.UpdateAsync(user, cancellationToken);
    }

    private string? ResolveTierFromPriceId(string? priceId)
    {
        if (string.IsNullOrWhiteSpace(priceId))
        {
            return null;
        }

        if (priceId == _configuration["Stripe:PriceId:Professional"])
        {
            return PlanTiers.Professional;
        }

        if (priceId == _configuration["Stripe:PriceId:RecruiterPro"])
        {
            return PlanTiers.RecruiterPro;
        }

        return null;
    }

    private string GetPriceId(string tier)
    {
        var key = tier == PlanTiers.RecruiterPro ? "Stripe:PriceId:RecruiterPro" : "Stripe:PriceId:Professional";
        var priceId = _configuration[key];
        if (string.IsNullOrWhiteSpace(priceId))
        {
            throw new InvalidOperationException($"Stripe price id is not configured for tier '{tier}'.");
        }

        return priceId;
    }

    private string GetFrontendBaseUrl()
    {
        return _configuration["Frontend:BaseUrl"]?.TrimEnd('/') ?? "http://localhost:5173";
    }
}
