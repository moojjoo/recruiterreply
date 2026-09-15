using System.Net.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using RecruiterReply.Entities;
using RecruiterReply.Models;
using RecruiterReply.Repositories;
using RecruiterReply.Tests.Testing;
using Stripe;
using BillingService = RecruiterReply.Services.BillingService;

namespace RecruiterReply.Tests.Services;

public class BillingServiceTests
{
    private const string WebhookSecret = "whsec_test_secret";
    private readonly Mock<IUserRepository> _userRepository = new();

    private static IConfiguration BuildConfig(Dictionary<string, string?>? values = null)
    {
        var defaults = new Dictionary<string, string?>
        {
            ["Stripe:WebhookSecret"] = WebhookSecret,
            ["Stripe:PriceId:Professional"] = "price_professional_test",
            ["Stripe:PriceId:RecruiterPro"] = "price_recruiterpro_test",
        };
        foreach (var (key, value) in values ?? [])
        {
            defaults[key] = value;
        }

        return new ConfigurationBuilder().AddInMemoryCollection(defaults).Build();
    }

    private BillingService CreateSut(IConfiguration? config = null, IStripeClient? stripeClient = null) =>
        new(_userRepository.Object, config ?? BuildConfig(), NullLogger<BillingService>.Instance, stripeClient);

    private static UserEntity BuildUser(string? stripeCustomerId = null) => new()
    {
        Id = Guid.NewGuid(),
        Email = "jane@example.com",
        StripeCustomerId = stripeCustomerId,
        SubscriptionTier = PlanTiers.Free,
    };

    // ----- CreateCheckoutSessionAsync -----

    [Fact]
    public async Task CreateCheckoutSessionAsync_WithInvalidTier_Throws()
    {
        var sut = CreateSut();

        await Assert.ThrowsAsync<ArgumentException>(() =>
            sut.CreateCheckoutSessionAsync(Guid.NewGuid(), "not-a-real-tier"));
    }

    [Fact]
    public async Task CreateCheckoutSessionAsync_WithUnknownUser_Throws()
    {
        var userId = Guid.NewGuid();
        _userRepository.Setup(r => r.GetByIdAsync(userId, It.IsAny<CancellationToken>())).ReturnsAsync((UserEntity?)null);
        var sut = CreateSut();

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            sut.CreateCheckoutSessionAsync(userId, PlanTiers.Professional));
    }

    // ----- CreatePortalSessionAsync -----

    [Fact]
    public async Task CreatePortalSessionAsync_WithUnknownUser_Throws()
    {
        var userId = Guid.NewGuid();
        _userRepository.Setup(r => r.GetByIdAsync(userId, It.IsAny<CancellationToken>())).ReturnsAsync((UserEntity?)null);
        var sut = CreateSut();

        await Assert.ThrowsAsync<InvalidOperationException>(() => sut.CreatePortalSessionAsync(userId));
    }

    [Fact]
    public async Task CreatePortalSessionAsync_WithNoStripeCustomerId_Throws()
    {
        var user = BuildUser(stripeCustomerId: null);
        _userRepository.Setup(r => r.GetByIdAsync(user.Id, It.IsAny<CancellationToken>())).ReturnsAsync(user);
        var sut = CreateSut();

        await Assert.ThrowsAsync<InvalidOperationException>(() => sut.CreatePortalSessionAsync(user.Id));
    }

    // ----- HandleWebhookAsync: configuration/signature -----

    [Fact]
    public async Task HandleWebhookAsync_WithoutConfiguredSecret_Throws()
    {
        var sut = CreateSut(BuildConfig(new Dictionary<string, string?> { ["Stripe:WebhookSecret"] = null }));

        await Assert.ThrowsAsync<InvalidOperationException>(() => sut.HandleWebhookAsync("{}", "t=1,v1=bad"));
    }

    [Fact]
    public async Task HandleWebhookAsync_WithBadSignature_ThrowsStripeException()
    {
        var sut = CreateSut();

        await Assert.ThrowsAsync<StripeException>(() =>
            sut.HandleWebhookAsync("{\"type\":\"customer.subscription.updated\"}", "t=1,v1=not-the-real-signature"));
    }

    [Fact]
    public async Task HandleWebhookAsync_WithUnhandledEventType_IsNoOp()
    {
        var payload = """{"id":"evt_1","object":"event","type":"some.unhandled.event","request":null,"api_version":"2025-02-24.acacia","data":{"object":{"object":"customer"}}}""";
        var signature = StripeSignatureHelper.BuildSignatureHeader(payload, WebhookSecret);
        var sut = CreateSut();

        await sut.HandleWebhookAsync(payload, signature);

        _userRepository.Verify(r => r.UpdateAsync(It.IsAny<UserEntity>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    // ----- HandleWebhookAsync: customer.subscription.updated -----

    [Fact]
    public async Task HandleWebhookAsync_SubscriptionUpdated_UpdatesStatusPeriodEndAndTier()
    {
        var user = BuildUser(stripeCustomerId: "cus_123");
        _userRepository.Setup(r => r.GetByStripeCustomerIdAsync("cus_123", It.IsAny<CancellationToken>())).ReturnsAsync(user);

        var payload = $$"""
            {
              "id": "evt_1",
              "object": "event",
              "request": null,
              "api_version": "2025-02-24.acacia",
              "type": "customer.subscription.updated",
              "data": {
                "object": {
                  "id": "sub_123",
                  "object": "subscription",
                  "customer": "cus_123",
                  "status": "active",
                  "current_period_end": 1893456000,
                  "items": {
                    "object": "list",
                    "data": [
                      {
                        "id": "si_1",
                        "object": "subscription_item",
                        "price": { "id": "price_professional_test", "object": "price" }
                      }
                    ]
                  }
                }
              }
            }
            """;
        var signature = StripeSignatureHelper.BuildSignatureHeader(payload, WebhookSecret);
        var sut = CreateSut();

        await sut.HandleWebhookAsync(payload, signature);

        Assert.Equal("sub_123", user.StripeSubscriptionId);
        Assert.Equal("active", user.SubscriptionStatus);
        Assert.Equal(PlanTiers.Professional, user.SubscriptionTier);
        Assert.NotNull(user.SubscriptionCurrentPeriodEnd);
        _userRepository.Verify(r => r.UpdateAsync(user, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task HandleWebhookAsync_SubscriptionUpdated_ForUnknownCustomer_IsNoOp()
    {
        _userRepository
            .Setup(r => r.GetByStripeCustomerIdAsync("cus_unknown", It.IsAny<CancellationToken>()))
            .ReturnsAsync((UserEntity?)null);

        var payload = """
            {
              "id": "evt_1",
              "object": "event",
              "request": null,
              "api_version": "2025-02-24.acacia",
              "type": "customer.subscription.updated",
              "data": {
                "object": {
                  "id": "sub_1",
                  "object": "subscription",
                  "customer": "cus_unknown",
                  "status": "active"
                }
              }
            }
            """;
        var signature = StripeSignatureHelper.BuildSignatureHeader(payload, WebhookSecret);
        var sut = CreateSut();

        await sut.HandleWebhookAsync(payload, signature);

        _userRepository.Verify(r => r.UpdateAsync(It.IsAny<UserEntity>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    // ----- HandleWebhookAsync: customer.subscription.deleted -----

    [Fact]
    public async Task HandleWebhookAsync_SubscriptionDeleted_RevertsUserToFreeTier()
    {
        var user = BuildUser(stripeCustomerId: "cus_123");
        user.SubscriptionTier = PlanTiers.Professional;
        user.SubscriptionStatus = "active";
        user.StripeSubscriptionId = "sub_123";
        user.SubscriptionCurrentPeriodEnd = DateTime.UtcNow.AddDays(10);
        _userRepository.Setup(r => r.GetByStripeCustomerIdAsync("cus_123", It.IsAny<CancellationToken>())).ReturnsAsync(user);

        var payload = """
            {
              "id": "evt_1",
              "object": "event",
              "request": null,
              "api_version": "2025-02-24.acacia",
              "type": "customer.subscription.deleted",
              "data": {
                "object": {
                  "id": "sub_123",
                  "object": "subscription",
                  "customer": "cus_123",
                  "status": "canceled"
                }
              }
            }
            """;
        var signature = StripeSignatureHelper.BuildSignatureHeader(payload, WebhookSecret);
        var sut = CreateSut();

        await sut.HandleWebhookAsync(payload, signature);

        Assert.Equal(PlanTiers.Free, user.SubscriptionTier);
        Assert.Equal("canceled", user.SubscriptionStatus);
        Assert.Null(user.StripeSubscriptionId);
        Assert.Null(user.SubscriptionCurrentPeriodEnd);
    }

    // ----- HandleWebhookAsync: checkout.session.completed -----

    [Fact]
    public async Task HandleWebhookAsync_CheckoutCompleted_WithMissingClientReferenceId_IsNoOp()
    {
        var payload = """
            {
              "id": "evt_1",
              "object": "event",
              "request": null,
              "api_version": "2025-02-24.acacia",
              "type": "checkout.session.completed",
              "data": {
                "object": {
                  "id": "cs_1",
                  "object": "checkout.session",
                  "customer": "cus_1"
                }
              }
            }
            """;
        var signature = StripeSignatureHelper.BuildSignatureHeader(payload, WebhookSecret);
        var sut = CreateSut();

        await sut.HandleWebhookAsync(payload, signature);

        _userRepository.Verify(r => r.UpdateAsync(It.IsAny<UserEntity>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task HandleWebhookAsync_CheckoutCompleted_WithUnknownUser_IsNoOp()
    {
        var userId = Guid.NewGuid();
        _userRepository.Setup(r => r.GetByIdAsync(userId, It.IsAny<CancellationToken>())).ReturnsAsync((UserEntity?)null);

        var payload = $$"""
            {
              "id": "evt_1",
              "object": "event",
              "request": null,
              "api_version": "2025-02-24.acacia",
              "type": "checkout.session.completed",
              "data": {
                "object": {
                  "id": "cs_1",
                  "object": "checkout.session",
                  "client_reference_id": "{{userId}}",
                  "customer": "cus_1"
                }
              }
            }
            """;
        var signature = StripeSignatureHelper.BuildSignatureHeader(payload, WebhookSecret);
        var sut = CreateSut();

        await sut.HandleWebhookAsync(payload, signature);

        _userRepository.Verify(r => r.UpdateAsync(It.IsAny<UserEntity>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task HandleWebhookAsync_CheckoutCompleted_WithoutSubscriptionId_SetsCustomerAndTierWithoutFetchingSubscription()
    {
        var user = BuildUser();
        _userRepository.Setup(r => r.GetByIdAsync(user.Id, It.IsAny<CancellationToken>())).ReturnsAsync(user);

        var payload = $$"""
            {
              "id": "evt_1",
              "object": "event",
              "request": null,
              "api_version": "2025-02-24.acacia",
              "type": "checkout.session.completed",
              "data": {
                "object": {
                  "id": "cs_1",
                  "object": "checkout.session",
                  "client_reference_id": "{{user.Id}}",
                  "customer": "cus_new",
                  "metadata": { "userId": "{{user.Id}}", "tier": "recruiter_pro" }
                }
              }
            }
            """;
        var signature = StripeSignatureHelper.BuildSignatureHeader(payload, WebhookSecret);
        var sut = CreateSut();

        await sut.HandleWebhookAsync(payload, signature);

        Assert.Equal("cus_new", user.StripeCustomerId);
        Assert.Equal(PlanTiers.RecruiterPro, user.SubscriptionTier);
        Assert.Null(user.StripeSubscriptionId);
        _userRepository.Verify(r => r.UpdateAsync(user, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task HandleWebhookAsync_CheckoutCompleted_WithSubscriptionId_FetchesAndAppliesSubscriptionDetails()
    {
        var user = BuildUser(stripeCustomerId: "cus_existing");
        _userRepository.Setup(r => r.GetByIdAsync(user.Id, It.IsAny<CancellationToken>())).ReturnsAsync(user);

        var stripeClient = new Mock<IStripeClient>();
        stripeClient
            .Setup(c => c.RequestAsync<Subscription>(
                It.IsAny<HttpMethod>(), It.Is<string>(p => p.Contains("sub_123")), It.IsAny<BaseOptions>(), It.IsAny<RequestOptions>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Subscription { Id = "sub_123", Status = "trialing", CurrentPeriodEnd = new DateTime(2027, 1, 1, 0, 0, 0, DateTimeKind.Utc) });

        var payload = $$"""
            {
              "id": "evt_1",
              "object": "event",
              "request": null,
              "api_version": "2025-02-24.acacia",
              "type": "checkout.session.completed",
              "data": {
                "object": {
                  "id": "cs_1",
                  "object": "checkout.session",
                  "client_reference_id": "{{user.Id}}",
                  "customer": "cus_existing",
                  "subscription": "sub_123",
                  "metadata": { "userId": "{{user.Id}}", "tier": "professional" }
                }
              }
            }
            """;
        var signature = StripeSignatureHelper.BuildSignatureHeader(payload, WebhookSecret);
        var sut = CreateSut(stripeClient: stripeClient.Object);

        await sut.HandleWebhookAsync(payload, signature);

        Assert.Equal("sub_123", user.StripeSubscriptionId);
        Assert.Equal("trialing", user.SubscriptionStatus);
        Assert.Equal(new DateTime(2027, 1, 1, 0, 0, 0, DateTimeKind.Utc), user.SubscriptionCurrentPeriodEnd);
        Assert.Equal(PlanTiers.Professional, user.SubscriptionTier);
    }

    [Fact]
    public async Task CreateCheckoutSessionAsync_WithoutExistingCustomer_CreatesStripeCustomerAndChecksOutSession()
    {
        var user = BuildUser(stripeCustomerId: null);
        _userRepository.Setup(r => r.GetByIdAsync(user.Id, It.IsAny<CancellationToken>())).ReturnsAsync(user);

        var stripeClient = new Mock<IStripeClient>();
        stripeClient
            .Setup(c => c.RequestAsync<Customer>(It.IsAny<HttpMethod>(), It.IsAny<string>(), It.IsAny<BaseOptions>(), It.IsAny<RequestOptions>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Customer { Id = "cus_brand_new" });
        stripeClient
            .Setup(c => c.RequestAsync<Stripe.Checkout.Session>(It.IsAny<HttpMethod>(), It.IsAny<string>(), It.IsAny<BaseOptions>(), It.IsAny<RequestOptions>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Stripe.Checkout.Session { Url = "https://checkout.stripe.com/pay/cs_test_123" });

        var sut = CreateSut(stripeClient: stripeClient.Object);

        var url = await sut.CreateCheckoutSessionAsync(user.Id, PlanTiers.Professional);

        Assert.Equal("https://checkout.stripe.com/pay/cs_test_123", url);
        Assert.Equal("cus_brand_new", user.StripeCustomerId);
        _userRepository.Verify(r => r.UpdateAsync(user, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task CreateCheckoutSessionAsync_WithExistingCustomer_DoesNotCreateANewStripeCustomer()
    {
        var user = BuildUser(stripeCustomerId: "cus_existing");
        _userRepository.Setup(r => r.GetByIdAsync(user.Id, It.IsAny<CancellationToken>())).ReturnsAsync(user);

        var stripeClient = new Mock<IStripeClient>();
        stripeClient
            .Setup(c => c.RequestAsync<Stripe.Checkout.Session>(It.IsAny<HttpMethod>(), It.IsAny<string>(), It.IsAny<BaseOptions>(), It.IsAny<RequestOptions>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Stripe.Checkout.Session { Url = "https://checkout.stripe.com/pay/cs_test_456" });

        var sut = CreateSut(stripeClient: stripeClient.Object);

        await sut.CreateCheckoutSessionAsync(user.Id, PlanTiers.RecruiterPro);

        stripeClient.Verify(
            c => c.RequestAsync<Customer>(It.IsAny<HttpMethod>(), It.IsAny<string>(), It.IsAny<BaseOptions>(), It.IsAny<RequestOptions>(), It.IsAny<CancellationToken>()),
            Times.Never);
        _userRepository.Verify(r => r.UpdateAsync(It.IsAny<UserEntity>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task CreatePortalSessionAsync_WithExistingCustomer_ReturnsPortalUrl()
    {
        var user = BuildUser(stripeCustomerId: "cus_existing");
        _userRepository.Setup(r => r.GetByIdAsync(user.Id, It.IsAny<CancellationToken>())).ReturnsAsync(user);

        var stripeClient = new Mock<IStripeClient>();
        stripeClient
            .Setup(c => c.RequestAsync<Stripe.BillingPortal.Session>(It.IsAny<HttpMethod>(), It.IsAny<string>(), It.IsAny<BaseOptions>(), It.IsAny<RequestOptions>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Stripe.BillingPortal.Session { Url = "https://billing.stripe.com/session/bps_test_123" });

        var sut = CreateSut(stripeClient: stripeClient.Object);

        var url = await sut.CreatePortalSessionAsync(user.Id);

        Assert.Equal("https://billing.stripe.com/session/bps_test_123", url);
    }
}
