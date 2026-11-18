using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;
using Moq;
using RecruiterReply.Models;
using RecruiterReply.Services;

namespace RecruiterReply.Tests.Services;

public sealed class CognitoSignedFreshnessTests
{
    private const string Issuer = "https://issuer.example.test";
    private static readonly SymmetricSecurityKey Key = new(Encoding.UTF8.GetBytes(
        "synthetic-local-test-signing-key-not-a-real-provider-secret"));

    [Theory]
    [InlineData("recent")]
    [InlineData("stale")]
    [InlineData("missing")]
    [InlineData("malformed")]
    [InlineData("future")]
    public async Task ValidatedTokenPreservesIssuerAndOriginalAuthTimeNotIssuedAt(string kind)
    {
        var now = DateTimeOffset.UtcNow;
        var original = now.AddMinutes(kind == "stale" ? -60 : kind == "future" ? 5 : -1);
        var token = Token(Issuer, kind == "missing" ? null : kind == "malformed" ? "bad" : original.ToUnixTimeSeconds().ToString());
        var identity = await Service().ValidateIdentityAsync(token, "nonce", CancellationToken.None);
        Assert.Equal(Issuer, identity.Issuer);
        Assert.Equal(kind is "missing" or "malformed" or "future" ? null :
            DateTimeOffset.FromUnixTimeSeconds(original.ToUnixTimeSeconds()), identity.AuthenticatedAt);
        if (kind == "stale") Assert.False(AuthenticationFreshness.IsRecent(identity.AuthenticatedAt, now));
    }

    [Fact]
    public async Task WrongIssuerCannotProduceVerifiedFreshness()
    {
        await Assert.ThrowsAsync<SecurityTokenInvalidIssuerException>(() =>
            Service().ValidateIdentityAsync(Token("https://wrong.example.test", DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString()),
                "nonce", CancellationToken.None));
    }

    private static CognitoBffService Service()
    {
        var metadata = new OpenIdConnectConfiguration { Issuer = Issuer };
        metadata.SigningKeys.Add(Key);
        return new CognitoBffService(new Mock<IHttpClientFactory>().Object,
            new EphemeralDataProtectionProvider(), Options.Create(new CognitoBffOptions
            { Issuer = Issuer, ClientId = "client" }),
            metadata: new StaticConfigurationManager<OpenIdConnectConfiguration>(metadata));
    }

    private static string Token(string issuer, string? authTime)
    {
        var claims = new List<Claim>
        {
            new("sub", "subject"), new("email", "test@example.com"), new("email_verified", "true"),
            new("nonce", "nonce"), new("token_use", "id"),
            new("iat", DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(), ClaimValueTypes.Integer64)
        };
        if (authTime is not null) claims.Add(new Claim("auth_time", authTime));
        return new JwtSecurityTokenHandler().WriteToken(new JwtSecurityToken(issuer, "client", claims,
            DateTime.UtcNow.AddMinutes(-2), DateTime.UtcNow.AddMinutes(5),
            new SigningCredentials(Key, SecurityAlgorithms.HmacSha256)));
    }
}
