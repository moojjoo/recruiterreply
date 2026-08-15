using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RecruiterReply.Data;
using RecruiterReply.Entities;
using RecruiterReply.Models;

namespace RecruiterReply.Services;

public class GoogleAuthService : IGoogleAuthService
{
    private readonly IConfiguration _configuration;
    private readonly RecruiterReplyDbContext _db;
    private readonly IJwtTokenService _jwtTokenService;
    private readonly IHttpClientFactory _httpClientFactory;

    public GoogleAuthService(
        IConfiguration configuration,
        RecruiterReplyDbContext db,
        IJwtTokenService jwtTokenService,
        IHttpClientFactory httpClientFactory)
    {
        _configuration = configuration;
        _db = db;
        _jwtTokenService = jwtTokenService;
        _httpClientFactory = httpClientFactory;
    }

    public string BuildAuthorizationUrl()
    {
        var clientId = _configuration["Google:ClientId"] ?? string.Empty;
        var redirectUri = _configuration["Google:RedirectUri"] ?? "http://localhost:5002/api/auth/google/callback";

        if (string.IsNullOrWhiteSpace(clientId))
        {
            throw new InvalidOperationException("Google:ClientId is not configured.");
        }

        var query = new Dictionary<string, string>
        {
            ["client_id"] = clientId,
            ["redirect_uri"] = redirectUri,
            ["response_type"] = "code",
            ["scope"] = "openid email profile",
            ["access_type"] = "offline",
            ["prompt"] = "consent"
        };

        return "https://accounts.google.com/o/oauth2/v2/auth?" +
               string.Join("&", query.Select(kvp =>
                   $"{Uri.EscapeDataString(kvp.Key)}={Uri.EscapeDataString(kvp.Value)}"));
    }

    public async Task<AuthResponse> ExchangeCodeForTokenAsync(string code, CancellationToken cancellationToken = default)
    {
        var clientId = _configuration["Google:ClientId"] ?? string.Empty;
        var clientSecret = _configuration["Google:ClientSecret"] ?? string.Empty;
        var redirectUri = _configuration["Google:RedirectUri"] ?? "http://localhost:5002/api/auth/google/callback";

        if (string.IsNullOrWhiteSpace(clientId) || string.IsNullOrWhiteSpace(clientSecret))
        {
            throw new InvalidOperationException("Google OAuth client configuration is incomplete.");
        }

        using var httpClient = _httpClientFactory.CreateClient();
        var form = new Dictionary<string, string>
        {
            ["code"] = code,
            ["client_id"] = clientId,
            ["client_secret"] = clientSecret,
            ["redirect_uri"] = redirectUri,
            ["grant_type"] = "authorization_code"
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, "https://oauth2.googleapis.com/token")
        {
            Content = new FormUrlEncodedContent(form)
        };

        using var response = await httpClient.SendAsync(request, cancellationToken);
        var payload = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException($"Google token exchange failed: {payload}");
        }

        using var tokenJson = JsonDocument.Parse(payload);
        var accessToken = tokenJson.RootElement.GetProperty("access_token").GetString();
        if (string.IsNullOrWhiteSpace(accessToken))
        {
            throw new InvalidOperationException("Google token response did not include an access token.");
        }

        using var userRequest = new HttpRequestMessage(HttpMethod.Get, "https://www.googleapis.com/oauth2/v3/userinfo");
        userRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

        using var userResponse = await httpClient.SendAsync(userRequest, cancellationToken);
        var userJson = await userResponse.Content.ReadAsStringAsync(cancellationToken);

        if (!userResponse.IsSuccessStatusCode)
        {
            throw new InvalidOperationException($"Google profile fetch failed: {userJson}");
        }

        using var userInfo = JsonDocument.Parse(userJson);
        var root = userInfo.RootElement;

        var email = root.TryGetProperty("email", out var emailProp) ? emailProp.GetString() : null;
        var firstName = root.TryGetProperty("given_name", out var givenNameProp) ? givenNameProp.GetString() : null;
        var lastName = root.TryGetProperty("family_name", out var familyNameProp) ? familyNameProp.GetString() : null;
        var picture = root.TryGetProperty("picture", out var pictureProp) ? pictureProp.GetString() : null;
        var providerUserId = root.TryGetProperty("sub", out var subProp) ? subProp.GetString() : null;

        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(providerUserId))
        {
            throw new InvalidOperationException("Google account is missing email or user identifier.");
        }

        var normalizedEmail = email.Trim();
        var existingUser = await _db.Users.FirstOrDefaultAsync(u => u.Email == normalizedEmail && u.IsActive);
        if (existingUser is null)
        {
            existingUser = await _db.Users.FirstOrDefaultAsync(u => u.AuthProvider == "google" && u.ProviderUserId == providerUserId && u.IsActive);
        }

        if (existingUser is null)
        {
            var now = DateTime.UtcNow;
            existingUser = new UserEntity
            {
                Id = Guid.NewGuid(),
                Email = normalizedEmail,
                PasswordHash = string.Empty,
                FirstName = firstName,
                LastName = lastName,
                ProfilePictureUrl = picture,
                AuthProvider = "google",
                ProviderUserId = providerUserId,
                CreatedAt = now,
                UpdatedAt = now,
                LastLogin = now,
                IsActive = true
            };

            _db.Users.Add(existingUser);
        }
        else
        {
            existingUser.Email = normalizedEmail;
            existingUser.FirstName = string.IsNullOrWhiteSpace(existingUser.FirstName) ? firstName : existingUser.FirstName;
            existingUser.LastName = string.IsNullOrWhiteSpace(existingUser.LastName) ? lastName : existingUser.LastName;
            existingUser.ProfilePictureUrl = picture ?? existingUser.ProfilePictureUrl;
            existingUser.AuthProvider = existingUser.AuthProvider == "email" ? "google" : existingUser.AuthProvider;
            existingUser.ProviderUserId ??= providerUserId;
            existingUser.LastLogin = DateTime.UtcNow;
            existingUser.UpdatedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync(cancellationToken);

        return new AuthResponse
        {
            Token = _jwtTokenService.GenerateToken(existingUser),
            User = new AuthUserDto
            {
                Id = existingUser.Id,
                Email = existingUser.Email,
                Name = $"{existingUser.FirstName} {existingUser.LastName}".Trim(),
                CreatedAt = existingUser.CreatedAt
            }
        };
    }
}
