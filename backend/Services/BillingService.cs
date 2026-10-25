using Microsoft.EntityFrameworkCore;
using RecruiterReply.Data;
using RecruiterReply.Models;
using RecruiterReply.Repositories;
using Stripe;
using System.Security.Cryptography;
using System.Text;

namespace RecruiterReply.Services;

public class BillingService : IBillingService
{
    private const int TrialPeriodDays = 7;

    private readonly IUserRepository _userRepository;
    private readonly IConfiguration _configuration;
    private readonly ILogger<BillingService> _logger;
    private readonly IStripeClient? _stripeClient;
    private readonly RecruiterReplyDbContext? _dbContext;

    public BillingService(IUserRepository userRepository, IConfiguration configuration, ILogger<BillingService> logger, IStripeClient? stripeClient = null, RecruiterReplyDbContext? dbContext = null)
    {
        _userRepository = userRepository;
        _configuration = configuration;
        _logger = logger;
        _stripeClient = stripeClient;
        _dbContext = dbContext;
    }

    public async Task<string> CreateCheckoutSessionAsync(Guid userId, string tier, CancellationToken cancellationToken = default)
    {
        if (tier != PlanTiers.Professional && tier != PlanTiers.RecruiterPro)
        {
            throw new ArgumentException("Invalid subscription tier.");
        }

        var user = await _userRepository.GetByIdAsync(userId, cancellationToken)
            ?? throw new InvalidOperationException("User not found.");

        if (user.SubscriptionTier != PlanTiers.Free && !string.IsNullOrWhiteSpace(user.StripeSubscriptionId))
        {
            throw new InvalidOperationException("An active subscription already exists. Use the supported upgrade or billing-management flow.");
        }

        return await CreateCheckoutSessionForUserAsync(user, tier, cancellationToken);
    }

    public async Task<string?> UpgradeToRecruiterProAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var user = await _userRepository.GetByIdAsync(userId, cancellationToken)
            ?? throw new InvalidOperationException("User not found.");

        if (user.SubscriptionTier != PlanTiers.Professional)
        {
            throw new InvalidOperationException("Only Professional subscriptions can be upgraded to Recruiter Pro.");
        }

        if (string.IsNullOrWhiteSpace(user.StripeSubscriptionId))
        {
            _logger.LogWarning(
                "Professional subscription is missing its Stripe subscription reference; starting a Recruiter Pro checkout");
            return await CreateCheckoutSessionForUserAsync(user, PlanTiers.RecruiterPro, cancellationToken);
        }

        var subscriptionService = _stripeClient is null ? new SubscriptionService() : new SubscriptionService(_stripeClient);
        var subscription = await subscriptionService.GetAsync(user.StripeSubscriptionId, cancellationToken: cancellationToken);
        var item = subscription.Items?.Data?.FirstOrDefault();
        if (item is null || string.IsNullOrWhiteSpace(item.Id))
        {
            throw new InvalidOperationException("The subscription does not contain an upgradeable item.");
        }

        if (subscription.Status is not ("active" or "trialing" or "past_due"))
        {
            throw new InvalidOperationException("This subscription cannot be upgraded in its current state.");
        }

        await subscriptionService.UpdateAsync(subscription.Id, new SubscriptionUpdateOptions
        {
            Items = [new SubscriptionItemOptions { Id = item.Id, Price = GetPriceId(PlanTiers.RecruiterPro) }],
            ProrationBehavior = "always_invoice",
            CancelAtPeriodEnd = false,
        }, cancellationToken: cancellationToken);

        return null;
    }

    private async Task<string> CreateCheckoutSessionForUserAsync(
        RecruiterReply.Entities.UserEntity user,
        string tier,
        CancellationToken cancellationToken)
    {
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
        var sessionService = _stripeClient is null
            ? new Stripe.Checkout.SessionService()
            : new Stripe.Checkout.SessionService(_stripeClient);
        var session = await sessionService.CreateAsync(new Stripe.Checkout.SessionCreateOptions
        {
            Mode = "subscription",
            Customer = user.StripeCustomerId,
            ClientReferenceId = user.Id.ToString(),
            LineItems =
            [
                new() { Price = GetPriceId(tier), Quantity = 1 },
            ],
            SubscriptionData = new Stripe.Checkout.SessionSubscriptionDataOptions
            {
                TrialPeriodDays = TrialPeriodDays,
            },
            SuccessUrl = $"{frontendBaseUrl}/dashboard?checkout=success",
            CancelUrl = $"{frontendBaseUrl}/pricing?checkout=cancelled",
            Metadata = new Dictionary<string, string> { ["userId"] = user.Id.ToString(), ["tier"] = tier },
        }, cancellationToken: cancellationToken);

        if (string.IsNullOrWhiteSpace(session.Url))
        {
            throw new InvalidOperationException("Stripe did not return a checkout URL.");
        }

        return session.Url;
    }

    public async Task<BillingPlanCatalogResponse> GetPlanCatalogAsync(CancellationToken cancellationToken = default)
    {
        var priceService = _stripeClient is null ? new PriceService() : new PriceService(_stripeClient);
        var plans = new List<BillingPlanResponse>();
        foreach (var (tier, priceId) in new[]
        {
            (PlanTiers.Professional, GetPriceId(PlanTiers.Professional)),
            (PlanTiers.RecruiterPro, GetPriceId(PlanTiers.RecruiterPro)),
        })
        {
            var price = await priceService.GetAsync(priceId, cancellationToken: cancellationToken);
            plans.Add(new BillingPlanResponse
            {
                Tier = tier,
                UnitAmount = price.UnitAmount,
                Currency = price.Currency ?? "usd",
                Interval = price.Recurring?.Interval,
                IntervalCount = price.Recurring?.IntervalCount,
            });
        }

        return new BillingPlanCatalogResponse { Plans = plans };
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

    public async Task CancelSubscriptionAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var user = await _userRepository.GetByIdAsync(userId, cancellationToken)
            ?? throw new InvalidOperationException("User not found.");

        if (string.IsNullOrWhiteSpace(user.StripeSubscriptionId))
        {
            throw new InvalidOperationException("No active subscription found.");
        }

        if (user.SubscriptionCancelAtPeriodEnd)
        {
            return;
        }

        var subscriptionService = _stripeClient is null
            ? new SubscriptionService()
            : new SubscriptionService(_stripeClient);
        var subscription = await subscriptionService.UpdateAsync(
            user.StripeSubscriptionId,
            new SubscriptionUpdateOptions { CancelAtPeriodEnd = true },
            cancellationToken: cancellationToken);

        user.SubscriptionStatus = subscription.Status;
        user.SubscriptionCurrentPeriodEnd = GetCurrentPeriodEnd(subscription);
        user.SubscriptionCancelAtPeriodEnd = subscription.CancelAtPeriodEnd;
        await _userRepository.UpdateAsync(user, cancellationToken);
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
            case "invoice.paid":
                await HandleInvoicePaidAsync(stripeEvent, cancellationToken);
                break;
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

    private async Task HandleInvoicePaidAsync(Event stripeEvent, CancellationToken cancellationToken)
    {
        if (stripeEvent.Data.Object is not Invoice invoice) return;

        // Stripe API 2025-04-30.basil puts subscription details under invoice.parent.
        // Trial invoices and one-off invoices are excluded from paid conversions.
        if (!PaidInvoiceRules.IsEligible(invoice.Id, invoice.Status, invoice.AmountPaid,
            invoice.Currency, invoice.Parent?.SubscriptionDetails is not null))
            return;

        if (string.IsNullOrWhiteSpace(invoice.CustomerId))
        {
            _logger.LogWarning("Paid invoice missing customer; cannot record payment");
            return;
        }

        if (_dbContext is null)
            throw new InvalidOperationException("Database context is required for paid invoice persistence.");

        // Unique invoice ID provides atomic idempotency across concurrent webhook retries.
        // Do not log customer identifiers or send them to GA4.
        await _dbContext.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO stripe_paid_invoices
                (id, stripe_invoice_id, stripe_event_id, stripe_customer_id,
                 amount_paid, currency, paid_at)
            VALUES
                ({Guid.NewGuid()}, {invoice.Id}, {stripeEvent.Id}, {invoice.CustomerId},
                 {invoice.AmountPaid}, {invoice.Currency}, {DateTime.UtcNow})
            ON CONFLICT (stripe_invoice_id) DO NOTHING
            """, cancellationToken);
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
        user.SubscriptionCancellationEventId = null;

        if (!string.IsNullOrWhiteSpace(session.SubscriptionId))
        {
            var subscriptionService = _stripeClient is null ? new SubscriptionService() : new SubscriptionService(_stripeClient);
            var subscription = await subscriptionService.GetAsync(session.SubscriptionId, cancellationToken: cancellationToken);
            user.SubscriptionStatus = subscription.Status;
            user.SubscriptionCurrentPeriodEnd = GetCurrentPeriodEnd(subscription);
            user.SubscriptionCancelAtPeriodEnd = subscription.CancelAtPeriodEnd;
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
        user.SubscriptionCurrentPeriodEnd = GetCurrentPeriodEnd(subscription);
        user.SubscriptionCancelAtPeriodEnd = subscription.CancelAtPeriodEnd;

        var priceId = subscription.Items?.Data?.FirstOrDefault()?.Price?.Id;
        var tier = ResolveTierFromPriceId(priceId);
        if (tier is not null)
        {
            user.SubscriptionTier = tier;
        }
        if (subscription.Status is not "canceled" and not "incomplete_expired")
        {
            user.SubscriptionCancellationEventId = null;
        }

        await _userRepository.UpdateAsync(user, cancellationToken);
    }

    // Since API version 2025-03-31.basil, billing periods live on subscription items.
    private static DateTime? GetCurrentPeriodEnd(Subscription subscription) =>
        subscription.Items?.Data?.FirstOrDefault()?.CurrentPeriodEnd;

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

        var wasActive = user.SubscriptionTier != PlanTiers.Free || user.SubscriptionStatus != "canceled";
        user.SubscriptionTier = PlanTiers.Free;
        user.SubscriptionStatus = "canceled";
        user.StripeSubscriptionId = null;
        user.SubscriptionCurrentPeriodEnd = null;
        user.SubscriptionCancelAtPeriodEnd = false;
        if (wasActive)
        {
            user.SubscriptionCancellationEventId = ToOpaqueEventId(stripeEvent.Id);
        }

        await _userRepository.UpdateAsync(user, cancellationToken);
    }

    private static Guid ToOpaqueEventId(string eventId)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(eventId));
        return new Guid(bytes[..16]);
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
