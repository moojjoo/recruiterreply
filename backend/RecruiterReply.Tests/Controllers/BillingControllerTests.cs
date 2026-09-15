using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using RecruiterReply.Controllers;
using RecruiterReply.Models;
using RecruiterReply.Services;
using RecruiterReply.Tests.Testing;
using Stripe;

namespace RecruiterReply.Tests.Controllers;

public class BillingControllerTests
{
    private readonly Mock<IBillingService> _billingService = new();
    private readonly Mock<IUsageService> _usageService = new();
    private readonly BillingController _sut;
    private readonly Guid _userId = Guid.NewGuid();

    public BillingControllerTests()
    {
        _sut = new BillingController(_billingService.Object, _usageService.Object, NullLogger<BillingController>.Instance);
        _sut.SetUser(_userId);
    }

    [Fact]
    public async Task CreateCheckoutSession_OnSuccess_Returns200WithUrl()
    {
        _billingService.Setup(s => s.CreateCheckoutSessionAsync(_userId, PlanTiers.Professional, It.IsAny<CancellationToken>()))
            .ReturnsAsync("https://checkout.stripe.com/pay/cs_1");

        var result = await _sut.CreateCheckoutSession(new CheckoutSessionRequest { Tier = PlanTiers.Professional }, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<CheckoutSessionResponse>(ok.Value);
        Assert.Equal("https://checkout.stripe.com/pay/cs_1", response.Url);
    }

    [Fact]
    public async Task CreateCheckoutSession_OnArgumentException_Returns400()
    {
        _billingService.Setup(s => s.CreateCheckoutSessionAsync(_userId, It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new ArgumentException("bad tier"));

        var result = await _sut.CreateCheckoutSession(new CheckoutSessionRequest { Tier = "bogus" }, CancellationToken.None);

        Assert.Equal(400, Assert.IsType<BadRequestObjectResult>(result).StatusCode);
    }

    [Fact]
    public async Task CreateCheckoutSession_OnUnhandledException_Returns500()
    {
        _billingService.Setup(s => s.CreateCheckoutSessionAsync(_userId, It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new StripeException("stripe down"));

        var result = await _sut.CreateCheckoutSession(new CheckoutSessionRequest { Tier = PlanTiers.Professional }, CancellationToken.None);

        Assert.Equal(500, Assert.IsType<ObjectResult>(result).StatusCode);
    }

    [Fact]
    public async Task CreatePortalSession_OnSuccess_Returns200WithUrl()
    {
        _billingService.Setup(s => s.CreatePortalSessionAsync(_userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync("https://billing.stripe.com/session/bps_1");

        var result = await _sut.CreatePortalSession(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<PortalSessionResponse>(ok.Value);
        Assert.Equal("https://billing.stripe.com/session/bps_1", response.Url);
    }

    [Fact]
    public async Task CreatePortalSession_OnInvalidOperationException_Returns400()
    {
        _billingService.Setup(s => s.CreatePortalSessionAsync(_userId, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("no billing account"));

        var result = await _sut.CreatePortalSession(CancellationToken.None);

        Assert.Equal(400, Assert.IsType<BadRequestObjectResult>(result).StatusCode);
    }

    [Fact]
    public async Task GetUsage_ReturnsUsageStatusFromService()
    {
        var status = new UsageStatusResponse { SubscriptionTier = PlanTiers.Free };
        _usageService.Setup(s => s.GetUsageStatusAsync(_userId, It.IsAny<CancellationToken>())).ReturnsAsync(status);

        var result = await _sut.GetUsage(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Same(status, ok.Value);
    }

    [Fact]
    public async Task Webhook_OnSuccess_Returns200()
    {
        _billingService
            .Setup(s => s.HandleWebhookAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        SetWebhookRequest("{}", "t=1,v1=sig");

        var result = await _sut.Webhook(CancellationToken.None);

        Assert.IsType<OkResult>(result);
    }

    [Fact]
    public async Task Webhook_OnStripeException_Returns400()
    {
        _billingService
            .Setup(s => s.HandleWebhookAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new StripeException("bad signature"));
        SetWebhookRequest("{}", "t=1,v1=bad");

        var result = await _sut.Webhook(CancellationToken.None);

        Assert.Equal(400, Assert.IsType<BadRequestObjectResult>(result).StatusCode);
    }

    [Fact]
    public async Task Webhook_OnUnhandledException_Returns500()
    {
        _billingService
            .Setup(s => s.HandleWebhookAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Exception("boom"));
        SetWebhookRequest("{}", "t=1,v1=sig");

        var result = await _sut.Webhook(CancellationToken.None);

        Assert.Equal(500, Assert.IsType<ObjectResult>(result).StatusCode);
    }

    private void SetWebhookRequest(string body, string signature)
    {
        var httpContext = new DefaultHttpContext();
        httpContext.Request.Body = new MemoryStream(System.Text.Encoding.UTF8.GetBytes(body));
        httpContext.Request.Headers["Stripe-Signature"] = signature;
        _sut.ControllerContext = new ControllerContext { HttpContext = httpContext };
    }
}
