using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;
using RecruiterReply.Models;

namespace RecruiterReply.Services;

public sealed record CognitoLoginRequest(string AuthorizationUrl);
public sealed record CognitoIdentity(string Subject, string Email, string? FirstName, string? LastName);
public sealed record CognitoTokenSet(string AccessToken, string? RefreshToken, string Scope, CognitoIdentity Identity);

public interface ICognitoBffService
{
    string BeginLogin(HttpContext context);
    Task<CognitoTokenSet> CompleteLoginAsync(HttpContext context, string code, string state, CancellationToken cancellationToken = default);
}

public sealed class CognitoBffService : ICognitoBffService
{
    private const string StateCookie = "__Host-rr_oauth_state";
    private const string StatePurpose = "recruiterreply-cognito-bff-state-v1";
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IDataProtector _protector;
    private readonly CognitoBffOptions _options;
    private readonly ConfigurationManager<OpenIdConnectConfiguration> _metadata;

    public CognitoBffService(IHttpClientFactory httpClientFactory, IDataProtectionProvider dataProtection,
        IOptions<CognitoBffOptions> options)
    {
        _httpClientFactory = httpClientFactory;
        _protector = dataProtection.CreateProtector(StatePurpose);
        _options = options.Value;
        _metadata = new ConfigurationManager<OpenIdConnectConfiguration>(
            $"{_options.Issuer.TrimEnd('/')}/.well-known/openid-configuration",
            new OpenIdConnectConfigurationRetriever(), new HttpDocumentRetriever { RequireHttps = true });
    }

    public string BeginLogin(HttpContext context)
    {
        EnsureConfigured();
        var state = RandomUrlToken(32);
        var verifier = RandomUrlToken(48);
        var nonce = RandomUrlToken(32);
        var statePayload = JsonSerializer.Serialize(new OAuthState(state, verifier, nonce, DateTimeOffset.UtcNow.AddMinutes(5)));
        var protectedState = _protector.Protect(statePayload);
        context.Response.Cookies.Append(StateCookie, protectedState, new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.Lax,
            // __Host- cookies must use the root path; otherwise browsers reject
            // the state cookie before the authorization callback can read it.
            Path = "/",
            MaxAge = TimeSpan.FromMinutes(5)
        });

        var challenge = Convert.ToBase64String(SHA256.HashData(Encoding.ASCII.GetBytes(verifier)))
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');
        var query = new Dictionary<string, string>
        {
            ["response_type"] = "code",
            ["client_id"] = _options.ClientId,
            ["redirect_uri"] = _options.RedirectUri,
            ["scope"] = $"openid email profile {ApiScope("read")} {ApiScope("write")}",
            ["state"] = state,
            ["nonce"] = nonce,
            ["code_challenge_method"] = "S256",
            ["code_challenge"] = challenge,
            ["resource"] = _options.ResourceIdentifier
        };
        return $"{_options.Domain.TrimEnd('/')}/oauth2/authorize?{string.Join('&', query.Select(pair =>
            $"{Uri.EscapeDataString(pair.Key)}={Uri.EscapeDataString(pair.Value)}"))}";
    }

    public async Task<CognitoTokenSet> CompleteLoginAsync(HttpContext context, string code, string state,
        CancellationToken cancellationToken = default)
    {
        EnsureConfigured();
        var protectedState = context.Request.Cookies[StateCookie];
        context.Response.Cookies.Delete(StateCookie, new CookieOptions { Path = "/", Secure = true, HttpOnly = true });
        if (string.IsNullOrWhiteSpace(protectedState) || string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(state))
            throw new InvalidOperationException("Invalid Cognito callback.");

        OAuthState saved;
        try { saved = JsonSerializer.Deserialize<OAuthState>(_protector.Unprotect(protectedState))!; }
        catch (Exception ex) when (ex is CryptographicException or JsonException or FormatException)
        { throw new InvalidOperationException("Invalid Cognito callback state.", ex); }
        if (saved is null || saved.ExpiresAt <= DateTimeOffset.UtcNow || !CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(saved.State), Encoding.UTF8.GetBytes(state)))
            throw new InvalidOperationException("Invalid Cognito callback state.");

        using var request = new HttpRequestMessage(HttpMethod.Post, $"{_options.Domain.TrimEnd('/')}/oauth2/token")
        {
            Content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["grant_type"] = "authorization_code", ["client_id"] = _options.ClientId,
                ["client_secret"] = _options.ClientSecret, ["code"] = code,
                ["redirect_uri"] = _options.RedirectUri, ["code_verifier"] = saved.Verifier
            })
        };
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        var response = await _httpClientFactory.CreateClient().SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode) throw new InvalidOperationException("Cognito token exchange failed.");
        var token = await response.Content.ReadFromJsonAsync<CognitoTokenResponse>(cancellationToken: cancellationToken)
            ?? throw new InvalidOperationException("Cognito token response was empty.");
        var identity = await ValidateIdentityAsync(token.IdToken, saved.Nonce, cancellationToken);
        var accessPrincipal = await ValidateAccessTokenAsync(token.AccessToken, cancellationToken);
        var scopes = accessPrincipal.FindFirst("scope")?.Value ?? token.Scope ?? string.Empty;
        if (!scopes.Split(' ', StringSplitOptions.RemoveEmptyEntries).Any(scope =>
            scope is not null && (scope == ApiScope("read") || scope == ApiScope("write"))))
            throw new SecurityTokenValidationException("Cognito access token has no usable API scope.");
        return new CognitoTokenSet(token.AccessToken, token.RefreshToken, scopes, identity);
    }

    private async Task<CognitoIdentity> ValidateIdentityAsync(string idToken, string nonce, CancellationToken cancellationToken)
    {
        var configuration = await _metadata.GetConfigurationAsync(cancellationToken);
        var validation = new TokenValidationParameters
        {
            ValidateIssuer = true, ValidIssuer = _options.Issuer,
            ValidateAudience = true, ValidAudience = _options.ClientId,
            ValidateLifetime = true, ClockSkew = TimeSpan.FromSeconds(30),
            ValidateIssuerSigningKey = true, IssuerSigningKeys = configuration.SigningKeys,
            NameClaimType = "sub"
        };
        var principal = new JwtSecurityTokenHandler().ValidateToken(idToken, validation, out var validated);
        if (validated is not JwtSecurityToken jwt || jwt.Payload.GetValueOrDefault("token_use")?.ToString() != "id"
            || principal.FindFirst("nonce")?.Value != nonce)
            throw new SecurityTokenValidationException("Invalid Cognito ID token use or nonce.");
        var subject = principal.FindFirst("sub")?.Value;
        var email = principal.FindFirst("email")?.Value;
        if (string.IsNullOrWhiteSpace(subject) || string.IsNullOrWhiteSpace(email) ||
            !string.Equals(principal.FindFirst("email_verified")?.Value, "true", StringComparison.OrdinalIgnoreCase))
            throw new SecurityTokenValidationException("Cognito identity is incomplete or unverified.");
        return new CognitoIdentity(subject, email.Trim().ToLowerInvariant(), principal.FindFirst("given_name")?.Value,
            principal.FindFirst("family_name")?.Value);
    }

    private async Task<ClaimsPrincipal> ValidateAccessTokenAsync(string accessToken, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(_options.ResourceIdentifier))
            throw new InvalidOperationException("Cognito BFF resource identifier is not configured.");
        var configuration = await _metadata.GetConfigurationAsync(cancellationToken);
        var parameters = new TokenValidationParameters
        {
            ValidateIssuer = true, ValidIssuer = _options.Issuer,
            ValidateAudience = true, ValidAudience = _options.ResourceIdentifier,
            ValidateLifetime = true, ClockSkew = TimeSpan.FromSeconds(30),
            ValidateIssuerSigningKey = true, IssuerSigningKeys = configuration.SigningKeys
        };
        var principal = new JwtSecurityTokenHandler().ValidateToken(accessToken, parameters, out var validated);
        if (validated is not JwtSecurityToken jwt || jwt.Payload.GetValueOrDefault("token_use")?.ToString() != "access"
            || principal.FindFirst("client_id")?.Value != _options.ClientId)
            throw new SecurityTokenValidationException("Invalid Cognito access token use or client.");
        return principal;
    }

    private void EnsureConfigured()
    {
        if (!_options.Enabled || string.IsNullOrWhiteSpace(_options.Issuer) || string.IsNullOrWhiteSpace(_options.ClientId)
            || string.IsNullOrWhiteSpace(_options.ClientSecret) || string.IsNullOrWhiteSpace(_options.Domain)
            || string.IsNullOrWhiteSpace(_options.ResourceIdentifier)
            || string.IsNullOrWhiteSpace(_options.RedirectUri))
            throw new InvalidOperationException("Cognito BFF is not configured.");
    }

    private string ApiScope(string scopeName) => $"{_options.ResourceIdentifier.TrimEnd('/')}/{scopeName}";

    private static string RandomUrlToken(int bytes) => Convert.ToBase64String(RandomNumberGenerator.GetBytes(bytes))
        .TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private sealed record OAuthState(string State, string Verifier, string Nonce, DateTimeOffset ExpiresAt);
    private sealed class CognitoTokenResponse
    {
        public string AccessToken { get; set; } = string.Empty;
        public string? RefreshToken { get; set; }
        public string IdToken { get; set; } = string.Empty;
        public string? Scope { get; set; }
    }
}
