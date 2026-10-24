using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Moq;
using RecruiterReply.Services;
using System.Net;
using System.Net.Http;

namespace RecruiterReply.Tests.Services;

public class StripeEnvironmentGuardTests
{
    [Theory]
    [InlineData("sk_test_123", false, true)]
    [InlineData("rk_test_123", false, true)]
    [InlineData("sk_live_123", false, false)]
    [InlineData("sk_live_123", true, true)]
    [InlineData("rk_live_123", true, true)]
    public void ValidateSecretKeyMode_RejectsWrongMode(string key, bool expectedLiveMode, bool valid)
    {
        var action = () => StripeEnvironmentGuard.ValidateSecretKeyMode(
            key,
            expectedLiveMode,
            expectedLiveMode ? ["sk_live_", "rk_live_"] : ["sk_test_", "rk_test_"]);

        if (valid) Assert.Null(Record.Exception(action));
        else Assert.IsType<InvalidOperationException>(Record.Exception(action));
    }

    [Fact]
    public void LoadSettings_ProductionDefaultsToLiveMode()
    {
        var configuration = new ConfigurationBuilder().Build();

        var settings = StripeEnvironmentGuard.LoadSettings(configuration, Environments.Production);

        Assert.True(settings.ExpectedLiveMode);
        Assert.Contains("sk_live_", settings.AllowedSecretKeyPrefixes);
    }

    [Fact]
    public async Task ValidateAsync_RequiredWithoutSecretFailsClosed()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Stripe:Required"] = "true" })
            .Build();
        var environment = new Mock<IHostEnvironment>();
        environment.SetupGet(e => e.EnvironmentName).Returns(Environments.Development);
        var factory = new Mock<IHttpClientFactory>();
        var guard = new StripeEnvironmentGuard(configuration, environment.Object, factory.Object);

        await Assert.ThrowsAsync<InvalidOperationException>(() => guard.ValidateAsync());
        factory.Verify(f => f.CreateClient(It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task ValidateAsync_WrongAccountFailsClosed()
    {
        var configuration = BuildPreflightConfiguration();
        var factory = BuildClientFactory(_ => "{\"id\":\"acct_wrong\",\"livemode\":false}");
        var guard = CreateGuard(configuration, factory);

        await Assert.ThrowsAsync<InvalidOperationException>(() => guard.ValidateAsync());
    }

    [Fact]
    public async Task ValidateAsync_WrongPriceModeFailsClosed()
    {
        var configuration = BuildPreflightConfiguration();
        var factory = BuildClientFactory(path => path.Contains("/v1/account", StringComparison.Ordinal)
            ? "{\"id\":\"acct_test\",\"livemode\":false}"
            : "{\"id\":\"price_1\",\"livemode\":true}");
        var guard = CreateGuard(configuration, factory);

        await Assert.ThrowsAsync<InvalidOperationException>(() => guard.ValidateAsync());
    }

    private static IConfiguration BuildPreflightConfiguration() => new ConfigurationBuilder()
        .AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Stripe:Required"] = "true",
            ["Stripe:Preflight:Enabled"] = "true",
            ["Stripe:ExpectedAccountId"] = "acct_test",
            ["Stripe:SecretKey"] = "sk_test_key",
            ["Stripe:WebhookSecret"] = "whsec_test",
            ["Stripe:PriceId:Professional"] = "price_professional",
            ["Stripe:PriceId:RecruiterPro"] = "price_recruiterpro",
        })
        .Build();

    private static StripeEnvironmentGuard CreateGuard(IConfiguration configuration, IHttpClientFactory factory)
    {
        var environment = new Mock<IHostEnvironment>();
        environment.SetupGet(e => e.EnvironmentName).Returns(Environments.Development);
        return new StripeEnvironmentGuard(configuration, environment.Object, factory);
    }

    private static IHttpClientFactory BuildClientFactory(Func<string, string> responseFactory)
    {
        var handler = new StubHandler(responseFactory);
        var client = new HttpClient(handler) { BaseAddress = new Uri("https://api.stripe.com") };
        var factory = new Mock<IHttpClientFactory>();
        factory.Setup(f => f.CreateClient("StripePreflight")).Returns(client);
        return factory.Object;
    }

    private sealed class StubHandler(Func<string, string> responseFactory) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(responseFactory(request.RequestUri!.AbsolutePath))
            });
        }
    }
}
