using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace RecruiterReply.Tests.Testing;

public static class ControllerTestHelper
{
    public static ClaimsPrincipal BuildUserPrincipal(Guid userId)
    {
        var claims = new List<Claim> { new(ClaimTypes.NameIdentifier, userId.ToString()) };
        var identity = new ClaimsIdentity(claims, "TestAuth");
        return new ClaimsPrincipal(identity);
    }

    /// <summary>
    /// Wires an authenticated user onto a controller under test, so calls to
    /// User.GetRequiredUserId() resolve the same way they do at runtime.
    /// </summary>
    public static void SetUser(this ControllerBase controller, Guid userId)
    {
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = BuildUserPrincipal(userId) },
        };
    }
}
