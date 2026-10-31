using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.Extensions.Configuration;
using RecruiterReply.Entities;
using RecruiterReply.Services;

namespace RecruiterReply.Tests.Services;

public class JwtTokenServiceTests
{
    private static IConfiguration BuildConfig(Dictionary<string, string?>? values = null)
    {
        return new ConfigurationBuilder().AddInMemoryCollection(values ?? []).Build();
    }

    private static UserEntity BuildUser()
    {
        return new UserEntity
        {
            Id = Guid.NewGuid(),
            Email = "jane@example.com",
            FirstName = "Jane",
            LastName = "Doe",
        };
    }

    [Fact]
    public void GenerateToken_WithoutJwtKey_Throws()
    {
        var sut = new JwtTokenService(BuildConfig());

        Assert.Throws<InvalidOperationException>(() => sut.GenerateToken(BuildUser()));
    }

    [Fact]
    public void GenerateToken_IncludesExpectedClaimsIssuerAndAudience()
    {
        var config = BuildConfig(new Dictionary<string, string?>
        {
            ["Jwt:Key"] = "a-sufficiently-long-test-signing-key-1234567890",
            ["Jwt:Issuer"] = "TestIssuer",
            ["Jwt:Audience"] = "TestAudience",
        });
        var sut = new JwtTokenService(config);
        var user = BuildUser();

        var token = sut.GenerateToken(user);

        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(token);
        Assert.Equal("TestIssuer", jwt.Issuer);
        Assert.Equal("TestAudience", jwt.Audiences.Single());
        Assert.Equal(user.Id.ToString(), jwt.Claims.Single(c => c.Type == ClaimTypes.NameIdentifier).Value);
        Assert.Equal(user.Email, jwt.Claims.Single(c => c.Type == ClaimTypes.Email).Value);
        Assert.Equal("Jane Doe", jwt.Claims.Single(c => c.Type == ClaimTypes.Name).Value);
    }

    [Fact]
    public void GenerateToken_WithoutIssuerOrAudienceConfigured_FallsBackToDefaults()
    {
        var config = BuildConfig(new Dictionary<string, string?>
        {
            ["Jwt:Key"] = "a-sufficiently-long-test-signing-key-1234567890",
        });
        var sut = new JwtTokenService(config);

        var token = sut.GenerateToken(BuildUser());

        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(token);
        Assert.Equal("RecruiterReply", jwt.Issuer);
        Assert.Equal("RecruiterReply.Client", jwt.Audiences.Single());
    }

    [Fact]
    public void GenerateToken_UsesInjectedUtcClockForExpiration()
    {
        var now = new DateTimeOffset(2026, 3, 8, 6, 30, 0, TimeSpan.Zero);
        var config = BuildConfig(new Dictionary<string, string?>
        {
            ["Jwt:Key"] = "a-sufficiently-long-test-signing-key-1234567890",
        });
        var sut = new JwtTokenService(config, new FixedTimeProvider(now));

        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(sut.GenerateToken(BuildUser()));

        Assert.Equal(now.AddHours(8).UtcDateTime, jwt.ValidTo);
    }

    private sealed class FixedTimeProvider(DateTimeOffset utcNow) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => utcNow;
    }
}
