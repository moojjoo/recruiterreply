using RecruiterReply.Models;

namespace RecruiterReply.Services;

public interface IUsageService
{
    Task EnsureWithinQuotaAsync(Guid userId, string feature, CancellationToken cancellationToken = default);
    Task IncrementUsageAsync(Guid userId, string feature, CancellationToken cancellationToken = default);
    Task<UsageStatusResponse> GetUsageStatusAsync(Guid userId, CancellationToken cancellationToken = default);
}
