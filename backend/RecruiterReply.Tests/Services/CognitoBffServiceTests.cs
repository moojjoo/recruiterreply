using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using Moq;
using RecruiterReply.Models;
using RecruiterReply.Services;
using System.Text.Json;

namespace RecruiterReply.Tests.Services;

public sealed class CognitoBffServiceTests
{
    [Fact]
    public void BeginLogin_UsesRootPathForHostPrefixedStateCookie()
    {
        var factory = new Mock<IHttpClientFactory>();
        var options = Options.Create(new CognitoBffOptions
        {
            Enabled = true,
            Issuer = "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test",
            ResourceIdentifier = "https://api.dev.example.test",
            ClientId = "client-id",
            ClientSecret = "client-secret",
            Domain = "https://example.auth.us-east-1.amazoncognito.com",
            RedirectUri = "https://dev.example.test/api/auth/cognito/callback",
        });
        var dataProtection = DataProtectionProvider.Create("recruiterreply-cognito-bff-tests");
        var sut = new CognitoBffService(factory.Object, dataProtection, options);
        var context = new DefaultHttpContext();

        sut.BeginLogin(context);

        var setCookie = Assert.Single(context.Response.Headers.SetCookie.ToArray());
        Assert.Contains("__Host-rr_oauth_state=", setCookie);
        Assert.Contains("path=/", setCookie, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("path=/api/auth/cognito", setCookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("secure", setCookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("httponly", setCookie, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void CognitoTokenResponse_MapsOAuthSnakeCaseFields()
    {
        var response = JsonSerializer.Deserialize<CognitoBffService.CognitoTokenResponse>(
            "{\"access_token\":\"access\",\"refresh_token\":\"refresh\",\"id_token\":\"identity\",\"scope\":\"openid api/read\"}");

        Assert.NotNull(response);
        Assert.Equal("access", response!.AccessToken);
        Assert.Equal("refresh", response.RefreshToken);
        Assert.Equal("identity", response.IdToken);
        Assert.Equal("openid api/read", response.Scope);
    }
}
