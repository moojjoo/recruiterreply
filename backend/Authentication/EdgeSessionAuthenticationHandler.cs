using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using RecruiterReply.Data;
using RecruiterReply.Entities;

namespace RecruiterReply.Authentication;

/// <summary>
/// Validates the short-lived, host-only session minted by the reviewed
/// Cognito edge gateway. The gateway and API must share the same secret through
/// approved secret storage; an absent or invalid configuration fails closed.
/// </summary>
public sealed class EdgeSessionAuthenticationHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    private const string CookieName = "rr_session";
    private const string Purpose = "rr_session";
    private const int KeyBytes = 32;
    private const int IvBytes = 12;
    private const int TagBytes = 16;
    private const int MaxLifetimeSeconds = 900;
    private readonly IConfiguration _configuration;
    private readonly RecruiterReplyDbContext _db;

    public EdgeSessionAuthenticationHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder,
        ISystemClock clock,
        IConfiguration configuration,
        RecruiterReplyDbContext db)
        : base(options, logger, encoder, clock)
    {
        _configuration = configuration;
        _db = db;
    }

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var cookie = Request.Cookies[CookieName];
        var secret = _configuration["EdgeSession:Secret"];
        var expectedIssuer = _configuration["EdgeSession:Issuer"];
        var expectedClientId = _configuration["EdgeSession:ClientId"];

        if (string.IsNullOrWhiteSpace(cookie) || string.IsNullOrWhiteSpace(secret)
            || string.IsNullOrWhiteSpace(expectedIssuer) || string.IsNullOrWhiteSpace(expectedClientId))
        {
            return AuthenticateResult.NoResult();
        }

        try
        {
            var payload = ReadPayload(cookie, secret);
            var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            if (payload is null || payload.Iss != expectedIssuer || payload.Aud != expectedClientId
                || string.IsNullOrWhiteSpace(payload.Sub) || payload.Exp <= now || payload.Iat > now
                || payload.Exp - payload.Iat > MaxLifetimeSeconds)
            {
                return AuthenticateResult.Fail("Invalid or expired edge session.");
            }

            if (!payload.EmailVerified || !IsSafeEmail(payload.Email))
            {
                return AuthenticateResult.Fail("Edge session does not contain a verified email.");
            }

            var providerUserId = $"{payload.Iss}|{payload.Sub}";
            var user = await _db.Users.SingleOrDefaultAsync(
                candidate => candidate.AuthProvider == "cognito" && candidate.ProviderUserId == providerUserId);

            if (user is null)
            {
                var normalizedEmail = payload.Email!.Trim().ToLowerInvariant();
                var existingEmail = await _db.Users.SingleOrDefaultAsync(candidate => candidate.Email == normalizedEmail);
                if (existingEmail is not null)
                {
                    return AuthenticateResult.Fail("Cognito account requires explicit account linking.");
                }

                user = new UserEntity
                {
                    Id = Guid.NewGuid(),
                    Email = normalizedEmail,
                    PasswordHash = string.Empty,
                    FirstName = payload.FirstName,
                    LastName = payload.LastName,
                    AuthProvider = "cognito",
                    ProviderUserId = providerUserId,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                    LastLogin = DateTime.UtcNow
                };
                _db.Users.Add(user);
                await _db.SaveChangesAsync();
            }
            else if (!user.IsActive)
            {
                return AuthenticateResult.Fail("User account is inactive.");
            }

            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Email, user.Email),
                new Claim(ClaimTypes.Name, $"{user.FirstName} {user.LastName}".Trim()),
                new Claim("identity_provider", "cognito")
            };
            var principal = new ClaimsPrincipal(new ClaimsIdentity(claims, Scheme.Name));
            return AuthenticateResult.Success(new AuthenticationTicket(principal, Scheme.Name));
        }
        catch (Exception ex) when (ex is FormatException or CryptographicException or JsonException)
        {
            return AuthenticateResult.Fail("Invalid edge session.");
        }
    }

    private static EdgeSessionPayload? ReadPayload(string value, string secret)
    {
        var parts = value.Split('.');
        if (parts.Length != 3 || Encoding.UTF8.GetByteCount(secret) < KeyBytes)
        {
            throw new FormatException("Invalid edge session format.");
        }

        var iv = Base64UrlDecode(parts[0]);
        var ciphertext = Base64UrlDecode(parts[1]);
        var tag = Base64UrlDecode(parts[2]);
        if (iv.Length != IvBytes || tag.Length != TagBytes || ciphertext.Length == 0)
        {
            throw new FormatException("Invalid edge session payload.");
        }

        var key = HkdfSha256(Encoding.UTF8.GetBytes(secret),
            Encoding.UTF8.GetBytes("recruiterreply-edge-cookie-v1"),
            Encoding.UTF8.GetBytes(Purpose), KeyBytes);
        var plaintext = new byte[ciphertext.Length];
        using var aes = new AesGcm(key, TagBytes);
        aes.Decrypt(iv, ciphertext, tag, plaintext, Encoding.UTF8.GetBytes(Purpose));
        return JsonSerializer.Deserialize<EdgeSessionPayload>(plaintext, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });
    }

    private static byte[] HkdfSha256(byte[] ikm, byte[] salt, byte[] info, int length)
    {
        using var extract = new HMACSHA256(salt);
        var prk = extract.ComputeHash(ikm);
        var output = new byte[length];
        var previous = Array.Empty<byte>();
        var offset = 0;
        byte counter = 1;
        while (offset < length)
        {
            using var expand = new HMACSHA256(prk);
            var input = new byte[previous.Length + info.Length + 1];
            Buffer.BlockCopy(previous, 0, input, 0, previous.Length);
            Buffer.BlockCopy(info, 0, input, previous.Length, info.Length);
            input[^1] = counter;
            previous = expand.ComputeHash(input);
            var count = Math.Min(previous.Length, length - offset);
            Buffer.BlockCopy(previous, 0, output, offset, count);
            offset += count;
            counter++;
        }
        return output;
    }

    private static byte[] Base64UrlDecode(string value) => Convert.FromBase64String(value.Replace('-', '+').Replace('_', '/') + new string('=', (4 - value.Length % 4) % 4));

    private static bool IsSafeEmail(string? email) => !string.IsNullOrWhiteSpace(email)
        && email.Length <= 255 && email.Contains('@') && !email.Contains('\r') && !email.Contains('\n');

    private sealed record EdgeSessionPayload(
        string Sub,
        string Iss,
        string Aud,
        long Iat,
        long Exp,
        string? Email,
        bool EmailVerified,
        string? FirstName,
        string? LastName);
}
