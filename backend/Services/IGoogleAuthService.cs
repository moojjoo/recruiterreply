using RecruiterReply.Models;

namespace RecruiterReply.Services;

public interface IGoogleAuthService
{
    string BuildAuthorizationUrl();
    Task<AuthResponse> ExchangeCodeForTokenAsync(string code, CancellationToken cancellationToken = default);
}
