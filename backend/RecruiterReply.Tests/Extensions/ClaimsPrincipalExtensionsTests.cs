using System.Security.Claims;
using RecruiterReply.Extensions;

namespace RecruiterReply.Tests.Extensions;

public class ClaimsPrincipalExtensionsTests
{
    [Fact]
    public void GetRequiredUserId_WithValidClaim_ReturnsUserId()
    {
        var userId = Guid.NewGuid();
        var principal = new ClaimsPrincipal(new ClaimsIdentity(
            [new Claim(ClaimTypes.NameIdentifier, userId.ToString())]));

        var result = principal.GetRequiredUserId();

        Assert.Equal(userId, result);
    }

    [Fact]
    public void GetRequiredUserId_WithMissingClaim_Throws()
    {
        var principal = new ClaimsPrincipal(new ClaimsIdentity());

        Assert.Throws<UnauthorizedAccessException>(() => principal.GetRequiredUserId());
    }

    [Fact]
    public void GetRequiredUserId_WithNonGuidClaim_Throws()
    {
        var principal = new ClaimsPrincipal(new ClaimsIdentity(
            [new Claim(ClaimTypes.NameIdentifier, "not-a-guid")]));

        Assert.Throws<UnauthorizedAccessException>(() => principal.GetRequiredUserId());
    }
}
