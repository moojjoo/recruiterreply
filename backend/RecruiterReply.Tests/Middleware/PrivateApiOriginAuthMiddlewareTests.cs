using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Http;
using RecruiterReply.Middleware;

namespace RecruiterReply.Tests.Middleware;

public class PrivateApiOriginAuthMiddlewareTests
{
    [Fact]
    public void IsLocalHealthProbe_OnlyAllowsUnforwardedHealthRoute()
    {
        var context = new DefaultHttpContext();
        context.Request.Path = "/health";
        Assert.True(PrivateApiOriginAuthMiddleware.IsLocalHealthProbe(context));

        context.Request.Headers["X-Forwarded-For"] = "203.0.113.10";
        Assert.False(PrivateApiOriginAuthMiddleware.IsLocalHealthProbe(context));

        context.Request.Path = "/api/health";
        context.Request.Headers.Remove("X-Forwarded-For");
        Assert.False(PrivateApiOriginAuthMiddleware.IsLocalHealthProbe(context));
    }

    [Fact]
    public void IsValidSignature_AcceptsCurrentMatchingSignature()
    {
        const string secret = "test-only-origin-signing-key-with-32-bytes";
        const string method = "POST";
        const string path = "/api/messages";
        const string query = "mode=reply";
        var now = DateTimeOffset.FromUnixTimeSeconds(1_800_000_000);
        var timestamp = now.ToUnixTimeSeconds().ToString();
        var canonical = $"{timestamp}\n{method}\n{path}\n{query}";
        var digest = HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.UTF8.GetBytes(canonical));
        var signature = Convert.ToBase64String(digest).TrimEnd('=').Replace('+', '-').Replace('/', '_');

        Assert.True(PrivateApiOriginAuthMiddleware.IsValidSignature(
            $"{timestamp}.{signature}", method, path, query, secret, now));
    }

    [Fact]
    public void IsValidSignature_RejectsTamperingExpiredAndMalformedValues()
    {
        const string secret = "test-only-origin-signing-key-with-32-bytes";
        var now = DateTimeOffset.FromUnixTimeSeconds(1_800_000_000);
        var timestamp = now.ToUnixTimeSeconds().ToString();
        var canonical = $"{timestamp}\nGET\n/api/health\n";
        var digest = HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.UTF8.GetBytes(canonical));
        var signature = Convert.ToBase64String(digest).TrimEnd('=').Replace('+', '-').Replace('/', '_');

        Assert.False(PrivateApiOriginAuthMiddleware.IsValidSignature(
            $"{timestamp}.{signature}", "POST", "/api/health", "", secret, now));
        Assert.False(PrivateApiOriginAuthMiddleware.IsValidSignature(
            $"{now.AddMinutes(-2).ToUnixTimeSeconds()}.{signature}", "GET", "/api/health", "", secret, now));
        Assert.False(PrivateApiOriginAuthMiddleware.IsValidSignature("bad", "GET", "/api/health", "", secret, now));
    }
}
