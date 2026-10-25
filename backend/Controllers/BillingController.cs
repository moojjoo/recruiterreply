using RecruiterReply.Extensions;
using RecruiterReply.Models;
using RecruiterReply.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace RecruiterReply.Controllers;

[ApiController]
[Route("api/billing")]
[Authorize]
public class BillingController : ControllerBase
{
    private readonly IBillingService _billingService;
    private readonly IUsageService _usageService;
    private readonly ILogger<BillingController> _logger;

    public BillingController(IBillingService billingService, IUsageService usageService, ILogger<BillingController> logger)
    {
        _billingService = billingService;
        _usageService = usageService;
        _logger = logger;
    }

    [HttpPost("checkout-session")]
    public async Task<IActionResult> CreateCheckoutSession([FromBody] CheckoutSessionRequest request, CancellationToken ct)
    {
        try
        {
            var userId = User.GetRequiredUserId();
            var url = await _billingService.CreateCheckoutSessionAsync(userId, request.Tier, ct);
            return Ok(new CheckoutSessionResponse { Url = url });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating Stripe checkout session");
            return StatusCode(500, new { error = "An error occurred while starting checkout" });
        }
    }

    [HttpPost("upgrade-recruiter-pro")]
    public async Task<IActionResult> UpgradeToRecruiterPro(CancellationToken ct)
    {
        try
        {
            var checkoutUrl = await _billingService.UpgradeToRecruiterProAsync(User.GetRequiredUserId(), ct);
            return Accepted(new UpgradeToRecruiterProResponse
            {
                Status = checkoutUrl is null ? "pending" : "checkout_required",
                Tier = PlanTiers.RecruiterPro,
                Url = checkoutUrl,
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error upgrading subscription to Recruiter Pro");
            return StatusCode(500, new { error = "An error occurred while upgrading the subscription" });
        }
    }

    [HttpGet("plans")]
    [AllowAnonymous]
    public async Task<IActionResult> GetPlans(CancellationToken ct)
    {
        try
        {
            return Ok(await _billingService.GetPlanCatalogAsync(ct));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error loading public billing plan catalog");
            return StatusCode(503, new { error = "Billing plans are temporarily unavailable" });
        }
    }

    [HttpPost("portal-session")]
    public async Task<IActionResult> CreatePortalSession(CancellationToken ct)
    {
        try
        {
            var userId = User.GetRequiredUserId();
            var url = await _billingService.CreatePortalSessionAsync(userId, ct);
            return Ok(new PortalSessionResponse { Url = url });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating Stripe billing portal session");
            return StatusCode(500, new { error = "An error occurred while opening the billing portal" });
        }
    }

    [HttpPost("cancel-subscription")]
    public async Task<IActionResult> CancelSubscription(CancellationToken ct)
    {
        try
        {
            var userId = User.GetRequiredUserId();
            await _billingService.CancelSubscriptionAsync(userId, ct);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error cancelling Stripe subscription");
            return StatusCode(500, new { error = "An error occurred while cancelling the subscription" });
        }
    }

    [HttpGet("usage")]
    public async Task<IActionResult> GetUsage(CancellationToken ct)
    {
        var userId = User.GetRequiredUserId();
        var status = await _usageService.GetUsageStatusAsync(userId, ct);
        return Ok(status);
    }

    [HttpPost("webhook")]
    [AllowAnonymous]
    public async Task<IActionResult> Webhook(CancellationToken ct)
    {
        var json = await new StreamReader(Request.Body).ReadToEndAsync(ct);
        var signature = Request.Headers["Stripe-Signature"].ToString();

        try
        {
            await _billingService.HandleWebhookAsync(json, signature, ct);
            return Ok();
        }
        catch (Stripe.StripeException ex)
        {
            // Covers both signature failures and event API version mismatches.
            _logger.LogWarning(ex, "Stripe webhook rejected: {Message}", ex.Message);
            return BadRequest(new { error = "Invalid webhook event" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing Stripe webhook");
            return StatusCode(500, new { error = "An error occurred while processing the webhook" });
        }
    }
}
