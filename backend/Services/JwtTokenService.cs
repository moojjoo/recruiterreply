using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using RecruiterReply.Entities;

namespace RecruiterReply.Services;

public class JwtTokenService : IJwtTokenService
{
    private readonly IConfiguration _configuration;
    private readonly TimeProvider _timeProvider;

    public JwtTokenService(IConfiguration configuration, TimeProvider? timeProvider = null)
    {
        _configuration = configuration;
        _timeProvider = timeProvider ?? TimeProvider.System;
    }

    public string GenerateToken(UserEntity user)
    {
        var issuer = _configuration["Jwt:Issuer"] ?? "RecruiterReply";
        var audience = _configuration["Jwt:Audience"] ?? "RecruiterReply.Client";
        var key = _configuration["Jwt:Key"] ?? throw new InvalidOperationException("Jwt:Key is required.");

        var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key));
        var credentials = new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Email, user.Email),
            new(ClaimTypes.Name, $"{user.FirstName} {user.LastName}".Trim())
        };

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: _timeProvider.GetUtcNow().UtcDateTime.AddHours(8),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
