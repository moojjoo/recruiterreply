using System.Security.Cryptography;
using System.Text;

namespace RecruiterReply.Tests.Testing;

/// <summary>
/// Signs a test webhook payload the same way Stripe does, so BillingService's real
/// EventUtility.ConstructEvent signature verification can be exercised without any network call.
/// </summary>
public static class StripeSignatureHelper
{
    public static string BuildSignatureHeader(string payload, string secret, DateTimeOffset? timestamp = null)
    {
        var ts = (timestamp ?? DateTimeOffset.UtcNow).ToUnixTimeSeconds();
        var signedPayload = $"{ts}.{payload}";
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(signedPayload));
        var signature = Convert.ToHexString(hash).ToLowerInvariant();
        return $"t={ts},v1={signature}";
    }
}
