using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using RecruiterReply.Data;
using RecruiterReply.Entities;
using RecruiterReply.Extensions;
using RecruiterReply.Models;
using RecruiterReply.Services;
using RecruiterReply.Authentication;

namespace RecruiterReply.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly RecruiterReplyDbContext _db;
    private readonly IPasswordHashService _passwordHashService;
    private readonly IJwtTokenService _jwtTokenService;
    private readonly IGoogleAuthService _googleAuthService;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AuthController> _logger;
    private readonly IAntiforgery? _antiforgery;
    private readonly ICognitoBffService? _cognitoBff;
    private readonly IBffSessionStore? _bffSessions;
    private readonly TimeProvider _timeProvider;

    public AuthController(
        RecruiterReplyDbContext db,
        IPasswordHashService passwordHashService,
        IJwtTokenService jwtTokenService,
        IGoogleAuthService googleAuthService,
        IConfiguration configuration,
        ILogger<AuthController> logger,
        IAntiforgery? antiforgery = null,
        ICognitoBffService? cognitoBff = null,
        IBffSessionStore? bffSessions = null,
        TimeProvider? timeProvider = null)
    {
        _db = db;
        _passwordHashService = passwordHashService;
        _jwtTokenService = jwtTokenService;
        _googleAuthService = googleAuthService;
        _configuration = configuration;
        _logger = logger;
        _antiforgery = antiforgery;
        _cognitoBff = cognitoBff;
        _bffSessions = bffSessions;
        _timeProvider = timeProvider ?? TimeProvider.System;
    }

    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<IActionResult> Register([FromBody] AuthRegisterRequest request, CancellationToken ct)
    {
        if (!IsLegacyAuthEnabled()) return StatusCode(StatusCodes.Status410Gone, new { error = "Password authentication has been retired." });
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new { error = "Email and password are required." });
        }

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var exists = await _db.Users.AnyAsync(u => u.Email == normalizedEmail, ct);
        if (exists)
        {
            return Conflict(new { error = "A user with this email already exists." });
        }

        var (firstName, lastName) = SplitName(request.Name);
        var now = _timeProvider.GetUtcNow().UtcDateTime;

        var user = new UserEntity
        {
            Id = Guid.NewGuid(),
            Email = normalizedEmail,
            PasswordHash = _passwordHashService.HashPassword(request.Password),
            FirstName = firstName,
            LastName = lastName,
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now,
            LastLogin = now
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync(ct);

        return Ok(CreateAuthResponse(user));
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login([FromBody] AuthLoginRequest request, CancellationToken ct)
    {
        if (!IsLegacyAuthEnabled()) return StatusCode(StatusCodes.Status410Gone, new { error = "Password authentication has been retired." });
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new { error = "Email and password are required." });
        }

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == normalizedEmail && u.IsActive, ct);
        if (user is null || !_passwordHashService.VerifyPassword(request.Password, user.PasswordHash))
        {
            return Unauthorized(new { error = "Invalid email or password." });
        }

        var now = _timeProvider.GetUtcNow().UtcDateTime;
        user.LastLogin = now;
        user.UpdatedAt = now;
        await _db.SaveChangesAsync(ct);

        return Ok(CreateAuthResponse(user));
    }

    [HttpGet("google/start")]
    [AllowAnonymous]
    public IActionResult GoogleStart()
    {
        if (!IsLegacyAuthEnabled()) return StatusCode(StatusCodes.Status410Gone, new { error = "Google JWT authentication has been retired." });
        try
        {
            var redirectUrl = _googleAuthService.BuildAuthorizationUrl();
            return Ok(new { redirectUrl });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to build Google authorization URL");
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("google/callback")]
    [AllowAnonymous]
    public async Task<IActionResult> GoogleCallback([FromQuery] string code, CancellationToken ct, [FromQuery] string? error = null)
    {
        if (!IsLegacyAuthEnabled()) return StatusCode(StatusCodes.Status410Gone, new { error = "Google JWT authentication has been retired." });
        var frontendBase = GetFrontendBaseUrl();
        if (frontendBase is null)
        {
            return StatusCode(StatusCodes.Status500InternalServerError, new { error = "Google login callback is not configured." });
        }

        if (string.IsNullOrWhiteSpace(code))
        {
            _logger.LogWarning(
                "Google OAuth callback missing code. Google error: {GoogleError}",
                error?.Replace("\r", "").Replace("\n", "") ?? "(none)");
            return Redirect($"{frontendBase}/login?error=google_auth_failed");
        }

        try
        {
            var result = await _googleAuthService.ExchangeCodeForTokenAsync(code, ct);
            return Redirect($"{frontendBase}/auth/google/callback?token={Uri.EscapeDataString(result.Token)}");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Google OAuth callback failed");
            return Redirect($"{frontendBase}/login?error=google_auth_failed");
        }
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> Me(CancellationToken ct)
    {
        var userId = User.GetRequiredUserId();
        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId && u.IsActive, ct);
        if (user is null)
        {
            return NotFound(new { error = "User not found." });
        }

        return Ok(ToUserDto(user));
    }

    [HttpGet("cognito/start")]
    [AllowAnonymous]
    public IActionResult CognitoStart()
    {
        if (_cognitoBff is null) return StatusCode(StatusCodes.Status503ServiceUnavailable);
        try { return Ok(new CognitoLoginRequest(_cognitoBff.BeginLogin(HttpContext))); }
        catch (InvalidOperationException ex) { _logger.LogWarning(ex, "Cognito BFF is unavailable"); return StatusCode(503); }
    }

    [HttpGet("cognito/callback")]
    [AllowAnonymous]
    public async Task<IActionResult> CognitoCallback([FromQuery] string? code, [FromQuery] string? state, CancellationToken ct)
    {
        if (_cognitoBff is null || _bffSessions is null) return StatusCode(StatusCodes.Status503ServiceUnavailable);
        var frontendBase = GetFrontendBaseUrl();
        if (frontendBase is null) return StatusCode(StatusCodes.Status500InternalServerError);
        try
        {
            var tokens = await _cognitoBff.CompleteLoginAsync(HttpContext, code ?? string.Empty, state ?? string.Empty, ct);
            var identity = await _db.UserIdentities.FirstOrDefaultAsync(candidate =>
                candidate.Provider == "cognito" && candidate.Subject == tokens.Identity.Subject, ct);
            var user = identity is null
                ? await _db.Users.FirstOrDefaultAsync(candidate =>
                    candidate.AuthProvider == "cognito" && candidate.ProviderUserId == tokens.Identity.Subject, ct)
                : await _db.Users.FirstOrDefaultAsync(candidate => candidate.Id == identity.UserId, ct);
            var now = _timeProvider.GetUtcNow();
            if (user is null)
            {
                if (await _db.Users.AnyAsync(candidate => candidate.Email == tokens.Identity.Email, ct))
                    throw new InvalidOperationException("Cognito account requires explicit account linking.");
                user = new UserEntity
                {
                    Id = Guid.NewGuid(), Email = tokens.Identity.Email, PasswordHash = string.Empty,
                    FirstName = tokens.Identity.FirstName, LastName = tokens.Identity.LastName,
                    AuthProvider = "cognito", ProviderUserId = tokens.Identity.Subject, IsActive = true,
                    CreatedAt = now.UtcDateTime, UpdatedAt = now.UtcDateTime, LastLogin = now.UtcDateTime
                };
                _db.Users.Add(user);
            }
            else if (!user.IsActive) throw new InvalidOperationException("Account is inactive.");
            if (identity is null)
            {
                identity = new UserIdentityEntity
                {
                    Id = Guid.NewGuid(), UserId = user.Id, Provider = "cognito",
                    Subject = tokens.Identity.Subject, Email = tokens.Identity.Email,
                    CreatedAt = now.UtcDateTime, LastUsedAt = now.UtcDateTime
                };
                _db.UserIdentities.Add(identity);
            }
            else
            {
                identity.Email = tokens.Identity.Email;
                identity.LastUsedAt = now.UtcDateTime;
            }
            user.LastLogin = now.UtcDateTime;
            user.UpdatedAt = now.UtcDateTime;
            await _db.SaveChangesAsync(ct);

            var sessionId = await _bffSessions.CreateAsync(new BffSession(user.Id, tokens.Identity.Subject,
                _configuration["CognitoBff:Issuer"] ?? string.Empty, _configuration["CognitoBff:ClientId"] ?? string.Empty,
                tokens.Scope, now, now, now.AddMinutes(30), now.AddHours(8), tokens.AccessToken, tokens.RefreshToken), ct);
            Response.Cookies.Append(BffSessionAuthenticationHandler.CookieName, sessionId, new CookieOptions
            {
                HttpOnly = true, Secure = true, SameSite = SameSiteMode.Lax, Path = "/", MaxAge = TimeSpan.FromHours(8)
            });
            return Redirect($"{frontendBase}/dashboard");
        }
        catch (Exception ex) when (ex is InvalidOperationException or SecurityTokenException or HttpRequestException)
        {
            _logger.LogWarning(ex, "Cognito BFF callback failed");
            return Redirect($"{frontendBase}/login?error=cognito_auth_failed");
        }
    }

    [HttpPost("logout")]
    [AllowAnonymous]
    public async Task<IActionResult> Logout(CancellationToken ct)
    {
        var sessionId = Request.Cookies[BffSessionAuthenticationHandler.CookieName];
        if (_bffSessions is not null && !string.IsNullOrWhiteSpace(sessionId))
            await _bffSessions.RevokeAsync(sessionId, ct);
        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.Lax,
            Path = "/"
        };

        // rr_session is the current Dev/Test edge gate. The production BFF
        // uses a host-only cookie and will adopt this same logout contract.
        Response.Cookies.Delete("rr_session", cookieOptions);
        Response.Cookies.Delete("__Host-rr_session", cookieOptions);

        return NoContent();
    }

    [HttpGet("csrf")]
    [AllowAnonymous]
    public IActionResult Csrf()
    {
        if (_antiforgery is null)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable);
        }

        var tokens = _antiforgery.GetAndStoreTokens(HttpContext);
        return Ok(new { token = tokens.RequestToken });
    }

    private AuthResponse CreateAuthResponse(UserEntity user)
    {
        return new AuthResponse
        {
            Token = _jwtTokenService.GenerateToken(user),
            User = ToUserDto(user)
        };
    }

    private static AuthUserDto ToUserDto(UserEntity user)
    {
        return new AuthUserDto
        {
            Id = user.Id,
            Email = user.Email,
            Name = $"{user.FirstName} {user.LastName}".Trim(),
            CreatedAt = user.CreatedAt
        };
    }

    private static (string? firstName, string? lastName) SplitName(string? name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return (null, null);
        }

        var parts = name.Trim().Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);
        return parts.Length == 1
            ? (parts[0], null)
            : (parts[0], parts[1]);
    }

    private string? GetFrontendBaseUrl()
    {
        var frontendBase = _configuration["Frontend:BaseUrl"];
        if (string.IsNullOrWhiteSpace(frontendBase)
            || !Uri.TryCreate(frontendBase, UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
        {
            _logger.LogError("Frontend:BaseUrl must be configured as an absolute HTTP or HTTPS URL for Google login.");
            return null;
        }

        return frontendBase.TrimEnd('/');
    }

    private bool IsLegacyAuthEnabled() => _configuration.GetValue("LegacyAuth:Enabled", true);
}
