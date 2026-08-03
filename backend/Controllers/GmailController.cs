using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RecruiterReply.Extensions;
using RecruiterReply.Models;
using RecruiterReply.Repositories;
using RecruiterReply.Services;

namespace RecruiterReply.Controllers;

[ApiController]
[Route("api/gmail")]
[Authorize]
public class GmailController : ControllerBase
{
    private readonly IGmailOAuthService _oAuthService;
    private readonly IGmailConnectionRepository _connectionRepository;
    private readonly GmailOptions _options;
    private readonly ILogger<GmailController> _logger;

    public GmailController(
        IGmailOAuthService oAuthService,
        IGmailConnectionRepository connectionRepository,
        Microsoft.Extensions.Options.IOptions<GmailOptions> options,
        ILogger<GmailController> logger)
    {
        _oAuthService = oAuthService;
        _connectionRepository = connectionRepository;
        _options = options.Value;
        _logger = logger;
    }

    [HttpGet("connect")]
    public IActionResult Connect()
    {
        var userId = User.GetRequiredUserId();
        var authorizationUrl = _oAuthService.BuildAuthorizationUrl(userId);
        return Ok(new { authorizationUrl });
    }

    /// <summary>
    /// Google redirects the browser here directly after consent — no JWT is present on this
    /// request. The signed `state` param (issued in Connect) is the only trust anchor.
    /// </summary>
    [HttpGet("callback")]
    [AllowAnonymous]
    public async Task<IActionResult> Callback([FromQuery] string? code, [FromQuery] string? state, [FromQuery] string? error, CancellationToken ct)
    {
        if (!string.IsNullOrEmpty(error))
        {
            _logger.LogWarning("Gmail OAuth consent denied or failed: {Error}", error);
            return Redirect(BuildFrontendRedirect(success: false, "consent_denied"));
        }

        if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(state))
        {
            return Redirect(BuildFrontendRedirect(success: false, "missing_code_or_state"));
        }

        var userId = _oAuthService.TryUnprotectState(state);
        if (userId is null)
        {
            return Redirect(BuildFrontendRedirect(success: false, "invalid_state"));
        }

        try
        {
            await _oAuthService.ExchangeCodeForTokensAsync(code, userId.Value, ct);
            return Redirect(BuildFrontendRedirect(success: true, null));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to exchange Gmail OAuth code for user {UserId}", userId);
            return Redirect(BuildFrontendRedirect(success: false, "token_exchange_failed"));
        }
    }

    [HttpGet("status")]
    public async Task<IActionResult> Status(CancellationToken ct)
    {
        var userId = User.GetRequiredUserId();
        var connection = await _connectionRepository.GetByUserIdAsync(userId, ct);

        if (connection is null || connection.Status == "disconnected")
        {
            return Ok(new GmailStatusResponse { IsConnected = false });
        }

        return Ok(new GmailStatusResponse
        {
            IsConnected = true,
            GoogleAccountEmail = connection.GoogleAccountEmail,
            Status = connection.Status,
            LastSyncedAt = connection.LastSyncedAt,
            LastSyncStatus = connection.LastSyncStatus,
            LastSyncError = connection.LastSyncError
        });
    }

    [HttpPost("disconnect")]
    public async Task<IActionResult> Disconnect(CancellationToken ct)
    {
        var userId = User.GetRequiredUserId();
        var connection = await _connectionRepository.GetByUserIdAsync(userId, ct);

        if (connection is null)
        {
            return NotFound();
        }

        await _oAuthService.DisconnectAsync(connection, ct);
        return Ok(new { disconnected = true });
    }

    private string BuildFrontendRedirect(bool success, string? errorCode)
    {
        var query = success ? "connected=true" : $"connected=false&error={Uri.EscapeDataString(errorCode ?? "unknown")}";
        var separator = _options.FrontendCallbackUrl.Contains('?') ? "&" : "?";
        return $"{_options.FrontendCallbackUrl}{separator}{query}";
    }
}
