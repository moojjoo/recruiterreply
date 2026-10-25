using System.Net.Http.Headers;
using System.Text.Json;

namespace RecruiterReply.Services;

public sealed record StripeEnvironmentSettings(
    bool Required,
    bool PreflightEnabled,
    bool ExpectedLiveMode,
    string? ExpectedAccountId,
    string[] AllowedSecretKeyPrefixes,
    string? WebhookSecret,
    string? ProfessionalPriceId,
    string? RecruiterProPriceId);

public interface IStripeEnvironmentGuard
{
    Task ValidateAsync(CancellationToken cancellationToken = default);
}

public sealed class StripeEnvironmentGuard : IStripeEnvironmentGuard
{
    private static readonly string[] DefaultTestPrefixes = ["sk_test_", "rk_test_"];
    private static readonly string[] DefaultLivePrefixes = ["sk_live_", "rk_live_"];

    private readonly IConfiguration _configuration;
    private readonly IHostEnvironment _environment;
    private readonly IHttpClientFactory _httpClientFactory;

    public StripeEnvironmentGuard(
        IConfiguration configuration,
        IHostEnvironment environment,
        IHttpClientFactory httpClientFactory)
    {
        _configuration = configuration;
        _environment = environment;
        _httpClientFactory = httpClientFactory;
    }

    public async Task ValidateAsync(CancellationToken cancellationToken = default)
    {
        var settings = LoadSettings(_configuration, _environment.EnvironmentName);
        var secretKey = _configuration["Stripe:SecretKey"];

        if (settings.Required && string.IsNullOrWhiteSpace(secretKey))
        {
            throw new InvalidOperationException("Stripe is required but Stripe:SecretKey is not configured.");
        }

        if (string.IsNullOrWhiteSpace(secretKey))
        {
            return;
        }

        ValidateSecretKeyMode(secretKey, settings.ExpectedLiveMode, settings.AllowedSecretKeyPrefixes);

        if (string.IsNullOrWhiteSpace(settings.WebhookSecret))
        {
            throw new InvalidOperationException("Stripe:WebhookSecret must be configured when Stripe is enabled.");
        }

        if (!settings.PreflightEnabled)
        {
            return;
        }

        if (string.IsNullOrWhiteSpace(settings.ExpectedAccountId))
        {
            throw new InvalidOperationException("Stripe:ExpectedAccountId must be configured when Stripe preflight is enabled.");
        }

        var client = _httpClientFactory.CreateClient("StripePreflight");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Basic",
            Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes($"{secretKey}:")));

        var account = await GetAsync(client, "/v1/account", cancellationToken);
        var accountId = account.GetProperty("id").GetString();
        if (!string.Equals(accountId, settings.ExpectedAccountId, StringComparison.Ordinal))
        {
            throw new InvalidOperationException("Stripe account identity does not match the configured environment.");
        }

        foreach (var priceId in new[] { settings.ProfessionalPriceId, settings.RecruiterProPriceId })
        {
            if (string.IsNullOrWhiteSpace(priceId))
            {
                throw new InvalidOperationException("Both Stripe subscription price IDs must be configured when Stripe preflight is enabled.");
            }

            var price = await GetAsync(client, $"/v1/prices/{Uri.EscapeDataString(priceId)}", cancellationToken);
            if (price.GetProperty("livemode").GetBoolean() != settings.ExpectedLiveMode)
            {
                throw new InvalidOperationException("A configured Stripe price belongs to the wrong mode for this environment.");
            }
        }
    }

    public static StripeEnvironmentSettings LoadSettings(IConfiguration configuration, string environmentName)
    {
        var expectedLiveMode = string.Equals(environmentName, "Production", StringComparison.OrdinalIgnoreCase);
        var configuredMode = configuration.GetValue<bool?>("Stripe:ExpectedLiveMode");
        if (configuredMode.HasValue && configuredMode.Value != expectedLiveMode)
        {
            throw new InvalidOperationException("Stripe:ExpectedLiveMode conflicts with the ASP.NET Core environment.");
        }
        var prefixes = configuration.GetSection("Stripe:AllowedSecretKeyPrefixes").Get<string[]>()
            ?? (expectedLiveMode ? DefaultLivePrefixes : DefaultTestPrefixes);

        return new StripeEnvironmentSettings(
            configuration.GetValue("Stripe:Required", false),
            configuration.GetValue("Stripe:Preflight:Enabled", false),
            expectedLiveMode,
            configuration["Stripe:ExpectedAccountId"],
            prefixes,
            configuration["Stripe:WebhookSecret"],
            configuration["Stripe:PriceId:Professional"],
            configuration["Stripe:PriceId:RecruiterPro"]);
    }

    public static void ValidateSecretKeyMode(string secretKey, bool expectedLiveMode, IReadOnlyCollection<string> allowedPrefixes)
    {
        var requiredPrefixes = expectedLiveMode ? DefaultLivePrefixes : DefaultTestPrefixes;
        if (!requiredPrefixes.Any(prefix => secretKey.StartsWith(prefix, StringComparison.Ordinal))
            || allowedPrefixes.Count == 0
            || !allowedPrefixes.Any(prefix =>
                secretKey.StartsWith(prefix, StringComparison.Ordinal)))
        {
            var expected = expectedLiveMode ? "live" : "test";
            throw new InvalidOperationException($"Stripe secret key does not match the expected {expected} mode.");
        }
    }

    private static async Task<JsonElement> GetAsync(HttpClient client, string path, CancellationToken cancellationToken)
    {
        using var response = await client.GetAsync(path, cancellationToken);
        response.EnsureSuccessStatusCode();
        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
        return document.RootElement.Clone();
    }
}
