using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using RecruiterReply.Data;
using RecruiterReply.Entities;
using RecruiterReply.Services;

namespace RecruiterReply.Controllers;

public sealed record RecoveryStartRequest(string Email);
public sealed record RecoveryFinishRequest(string Email, string? Code, string? Token, string Password);

[ApiController]
[AllowAnonymous]
[Route("api/auth/password-recovery")]
[EnableRateLimiting("password-recovery")]
public sealed class PasswordRecoveryController(
    RecruiterReplyDbContext db, IPasswordHashService passwords,
    IRecoveryEmailSender sender, IConfiguration config, ILogger<PasswordRecoveryController> logger) : ControllerBase
{
    private static readonly object Neutral = new { message = "If an account exists, recovery instructions will be sent." };
    private static string Hash(string secret) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(secret)));
    private static string CodeHash(Guid id, string code, string pepper) =>
        Hash(id.ToString("N") + ":" + code + ":" + pepper);

    [HttpPost("request")]
    public async Task<IActionResult> RequestRecovery([FromBody] RecoveryStartRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || request.Email.Length > 255)
            return Ok(Neutral);
        if (!config.GetValue<bool>("PasswordRecovery:EmailEnabled"))
            return Ok(Neutral);

        var email = request.Email.Trim().ToLowerInvariant();
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Email == email && u.IsActive, ct);
        if (user is null) return Ok(Neutral);
        var now = DateTime.UtcNow;
        if (await db.PasswordRecoveries.AnyAsync(r => r.UserId == user.Id &&
            r.CreatedAt > now.AddMinutes(-2), ct))
            return Ok(Neutral);

        var pepper = config["PasswordRecovery:CodePepper"];
        var frontend = config["Frontend:BaseUrl"];
        if (string.IsNullOrWhiteSpace(pepper) || pepper.Length < 32 ||
            !Uri.TryCreate(frontend, UriKind.Absolute, out var origin) ||
            origin.Scheme != Uri.UriSchemeHttps && !origin.IsLoopback)
        {
            logger.LogWarning("Password recovery configuration incomplete");
            return Ok(Neutral);
        }

        var code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        var recovery = new PasswordRecoveryEntity
        {
            Id = Guid.NewGuid(), UserId = user.Id, TokenHash = Hash(token),
            CreatedAt = now, ExpiresAt = now.AddMinutes(10)
        };
        recovery.CodeHash = CodeHash(recovery.Id, code, pepper);
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        db.PasswordRecoveries.Add(recovery);
        await db.SaveChangesAsync(ct);
        try
        {
            var link = frontend!.TrimEnd('/') + "/reset-password?email=" +
                Uri.EscapeDataString(email) + "&token=" + Uri.EscapeDataString(token);
            await sender.SendAsync(email, code, link, ct);
            await transaction.CommitAsync(ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning("Recovery email delivery failed: {ErrorType}", ex.GetType().Name);
            await transaction.RollbackAsync(ct);
        }
        return Ok(Neutral);
    }

    [HttpPost("complete")]
    public async Task<IActionResult> Complete([FromBody] RecoveryFinishRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || request.Email.Length > 255 ||
            string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 12 ||
            request.Password.Length > 256 ||
            (string.IsNullOrWhiteSpace(request.Token) && (request.Code?.Length != 6 || !request.Code.All(char.IsAsciiDigit))))
            return BadRequest(new { error = "Invalid or expired recovery credentials." });

        var pepper = config["PasswordRecovery:CodePepper"];
        if (string.IsNullOrWhiteSpace(pepper) || pepper.Length < 32)
            return BadRequest(new { error = "Invalid or expired recovery credentials." });

        // Lock the account row so simultaneous requests cannot both consume the same code.
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var email = request.Email.Trim().ToLowerInvariant();
        var user = await db.Users.FromSqlInterpolated(
            $"SELECT * FROM users WHERE email = {email} AND is_active = true FOR UPDATE")
            .FirstOrDefaultAsync(ct);
        if (user is null) return BadRequest(new { error = "Invalid or expired recovery credentials." });

        var now = DateTime.UtcNow;
        var active = await db.PasswordRecoveries
            .Where(r => r.UserId == user.Id && r.ConsumedAt == null && r.ExpiresAt > now && r.Attempts < 5)
            .OrderByDescending(r => r.CreatedAt).FirstOrDefaultAsync(ct);
        if (active is null) return BadRequest(new { error = "Invalid or expired recovery credentials." });

        var valid = !string.IsNullOrWhiteSpace(request.Token)
            ? request.Token.Length == 64 && CryptographicOperations.FixedTimeEquals(
                Convert.FromHexString(active.TokenHash), SHA256.HashData(Encoding.UTF8.GetBytes(request.Token)))
            : CryptographicOperations.FixedTimeEquals(
                Convert.FromHexString(active.CodeHash),
                Convert.FromHexString(CodeHash(active.Id, request.Code!, pepper)));
        if (!valid)
        {
            active.Attempts++;
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            return BadRequest(new { error = "Invalid or expired recovery credentials." });
        }

        user.PasswordHash = passwords.HashPassword(request.Password);
        user.UpdatedAt = now;
        // Invalidate all outstanding recovery credentials for this account.
        var pending = await db.PasswordRecoveries.Where(r => r.UserId == user.Id && r.ConsumedAt == null).ToListAsync(ct);
        foreach (var entry in pending) entry.ConsumedAt = now;
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return Ok(new { message = "Password updated. You can now sign in." });
    }
}
