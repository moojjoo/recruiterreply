using RecruiterReply.Entities;
using RecruiterReply.Models;
using RecruiterReply.Repositories;

namespace RecruiterReply.Services;

public class UsageService : IUsageService
{
    private static readonly string[] TrackedFeatures =
    [
        UsageFeatures.Analyze,
        UsageFeatures.Reply,
        UsageFeatures.Compare,
    ];

    private readonly IUsageRepository _usageRepository;
    private readonly IUserRepository _userRepository;

    public UsageService(IUsageRepository usageRepository, IUserRepository userRepository)
    {
        _usageRepository = usageRepository;
        _userRepository = userRepository;
    }

    public async Task EnsureWithinQuotaAsync(Guid userId, string feature, CancellationToken cancellationToken = default)
    {
        var user = await _userRepository.GetByIdAsync(userId, cancellationToken)
            ?? throw new InvalidOperationException("User not found.");

        var limit = PlanLimits.GetLimit(user.SubscriptionTier, feature);
        if (limit is null)
        {
            return;
        }

        var periodStart = CurrentPeriodStart();
        var record = await _usageRepository.GetForPeriodAsync(userId, feature, periodStart, cancellationToken);
        if (record is not null && record.Count >= limit)
        {
            throw new QuotaExceededException(
                $"You've reached your plan's monthly limit for this feature. Upgrade to keep going.");
        }
    }

    public async Task IncrementUsageAsync(Guid userId, string feature, CancellationToken cancellationToken = default)
    {
        var periodStart = CurrentPeriodStart();
        var record = await _usageRepository.GetForPeriodAsync(userId, feature, periodStart, cancellationToken);

        if (record is null)
        {
            await _usageRepository.AddAsync(new UsageRecordEntity
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Feature = feature,
                PeriodStart = periodStart,
                Count = 1,
            }, cancellationToken);
            return;
        }

        record.Count += 1;
        await _usageRepository.UpdateAsync(record, cancellationToken);
    }

    public async Task<UsageStatusResponse> GetUsageStatusAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var user = await _userRepository.GetByIdAsync(userId, cancellationToken)
            ?? throw new InvalidOperationException("User not found.");

        var periodStart = CurrentPeriodStart();
        var records = await _usageRepository.GetForPeriodAsync(userId, periodStart, cancellationToken);
        var usedByFeature = records.ToDictionary(r => r.Feature, r => r.Count);

        var usage = TrackedFeatures.Select(feature => new FeatureUsageStatus
        {
            Feature = feature,
            Used = usedByFeature.TryGetValue(feature, out var count) ? count : 0,
            Limit = PlanLimits.GetLimit(user.SubscriptionTier, feature),
        }).ToList();

        return new UsageStatusResponse
        {
            SubscriptionTier = user.SubscriptionTier,
            SubscriptionStatus = user.SubscriptionStatus,
            SubscriptionCurrentPeriodEnd = user.SubscriptionCurrentPeriodEnd,
            Usage = usage,
        };
    }

    private static DateTime CurrentPeriodStart()
    {
        var now = DateTime.UtcNow;
        return new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
    }
}
