using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RecruiterReply.Data;
using RecruiterReply.Entities;
using RecruiterReply.Extensions;
using RecruiterReply.Models;
using RecruiterReply.Services;

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

    public AuthController(
        RecruiterReplyDbContext db,
        IPasswordHashService passwordHashService,
        IJwtTokenService jwtTokenService,
        IGoogleAuthService googleAuthService,
        IConfiguration configuration,
        ILogger<AuthController> logger)
    {
        _db = db;
        _passwordHashService = passwordHashService;
        _jwtTokenService = jwtTokenService;
        _googleAuthService = googleAuthService;
        _configuration = configuration;
        _logger = logger;
    }

    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<IActionResult> Register([FromBody] AuthRegisterRequest request, CancellationToken ct)
    {
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
        var now = DateTime.UtcNow;

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

        user.LastLogin = DateTime.UtcNow;
        user.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        return Ok(CreateAuthResponse(user));
    }

    [HttpGet("google/start")]
    [AllowAnonymous]
    public IActionResult GoogleStart()
    {
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
}
