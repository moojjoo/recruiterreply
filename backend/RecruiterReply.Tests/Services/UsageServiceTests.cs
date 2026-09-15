using Moq;
using RecruiterReply.Entities;
using RecruiterReply.Models;
using RecruiterReply.Repositories;
using RecruiterReply.Services;

namespace RecruiterReply.Tests.Services;

public class UsageServiceTests
{
    private readonly Mock<IUsageRepository> _usageRepository = new();
    private readonly Mock<IUserRepository> _userRepository = new();
    private readonly UsageService _sut;

    public UsageServiceTests()
    {
        _sut = new UsageService(_usageRepository.Object, _userRepository.Object);
    }

    private static UserEntity BuildUser(string tier) => new() { Id = Guid.NewGuid(), SubscriptionTier = tier };

    [Fact]
    public async Task EnsureWithinQuotaAsync_WithNoExistingUsageRecord_Passes()
    {
        var user = BuildUser(PlanTiers.Free);
        _userRepository.Setup(r => r.GetByIdAsync(user.Id, It.IsAny<CancellationToken>())).ReturnsAsync(user);
        _usageRepository
            .Setup(r => r.GetForPeriodAsync(user.Id, UsageFeatures.Analyze, It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((UsageRecordEntity?)null);

        await _sut.EnsureWithinQuotaAsync(user.Id, UsageFeatures.Analyze);
    }

    [Fact]
    public async Task EnsureWithinQuotaAsync_UnderLimit_Passes()
    {
        var user = BuildUser(PlanTiers.Free);
        _userRepository.Setup(r => r.GetByIdAsync(user.Id, It.IsAny<CancellationToken>())).ReturnsAsync(user);
        _usageRepository
            .Setup(r => r.GetForPeriodAsync(user.Id, UsageFeatures.Analyze, It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UsageRecordEntity { Count = 4 });

        await _sut.EnsureWithinQuotaAsync(user.Id, UsageFeatures.Analyze);
    }

    [Fact]
    public async Task EnsureWithinQuotaAsync_AtLimit_ThrowsQuotaExceeded()
    {
        var user = BuildUser(PlanTiers.Free);
        _userRepository.Setup(r => r.GetByIdAsync(user.Id, It.IsAny<CancellationToken>())).ReturnsAsync(user);
        _usageRepository
            .Setup(r => r.GetForPeriodAsync(user.Id, UsageFeatures.Analyze, It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UsageRecordEntity { Count = 5 });

        await Assert.ThrowsAsync<QuotaExceededException>(() => _sut.EnsureWithinQuotaAsync(user.Id, UsageFeatures.Analyze));
    }

    [Fact]
    public async Task EnsureWithinQuotaAsync_OnUnlimitedTier_AlwaysPasses()
    {
        var user = BuildUser(PlanTiers.RecruiterPro);
        _userRepository.Setup(r => r.GetByIdAsync(user.Id, It.IsAny<CancellationToken>())).ReturnsAsync(user);
        _usageRepository
            .Setup(r => r.GetForPeriodAsync(user.Id, UsageFeatures.Analyze, It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UsageRecordEntity { Count = 999_999 });

        await _sut.EnsureWithinQuotaAsync(user.Id, UsageFeatures.Analyze);

        _usageRepository.Verify(
            r => r.GetForPeriodAsync(user.Id, UsageFeatures.Analyze, It.IsAny<DateTime>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task EnsureWithinQuotaAsync_WithMissingUser_Throws()
    {
        var userId = Guid.NewGuid();
        _userRepository.Setup(r => r.GetByIdAsync(userId, It.IsAny<CancellationToken>())).ReturnsAsync((UserEntity?)null);

        await Assert.ThrowsAsync<InvalidOperationException>(() => _sut.EnsureWithinQuotaAsync(userId, UsageFeatures.Analyze));
    }

    [Fact]
    public async Task IncrementUsageAsync_WithNoExistingRecord_AddsNewRecordWithCountOne()
    {
        var userId = Guid.NewGuid();
        _usageRepository
            .Setup(r => r.GetForPeriodAsync(userId, UsageFeatures.Reply, It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((UsageRecordEntity?)null);

        await _sut.IncrementUsageAsync(userId, UsageFeatures.Reply);

        _usageRepository.Verify(r => r.AddAsync(
            It.Is<UsageRecordEntity>(e => e.UserId == userId && e.Feature == UsageFeatures.Reply && e.Count == 1),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task IncrementUsageAsync_WithExistingRecord_IncrementsCount()
    {
        var userId = Guid.NewGuid();
        var record = new UsageRecordEntity { UserId = userId, Feature = UsageFeatures.Reply, Count = 3 };
        _usageRepository
            .Setup(r => r.GetForPeriodAsync(userId, UsageFeatures.Reply, It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(record);

        await _sut.IncrementUsageAsync(userId, UsageFeatures.Reply);

        Assert.Equal(4, record.Count);
        _usageRepository.Verify(r => r.UpdateAsync(record, It.IsAny<CancellationToken>()), Times.Once);
        _usageRepository.Verify(r => r.AddAsync(It.IsAny<UsageRecordEntity>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task GetUsageStatusAsync_ReturnsTierAndPerFeatureUsage()
    {
        var user = BuildUser(PlanTiers.Professional);
        _userRepository.Setup(r => r.GetByIdAsync(user.Id, It.IsAny<CancellationToken>())).ReturnsAsync(user);
        _usageRepository
            .Setup(r => r.GetForPeriodAsync(user.Id, It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync([new UsageRecordEntity { Feature = UsageFeatures.Analyze, Count = 7 }]);

        var status = await _sut.GetUsageStatusAsync(user.Id);

        Assert.Equal(PlanTiers.Professional, status.SubscriptionTier);
        var analyze = status.Usage.Single(u => u.Feature == UsageFeatures.Analyze);
        Assert.Equal(7, analyze.Used);
        Assert.Equal(200, analyze.Limit);
        var reply = status.Usage.Single(u => u.Feature == UsageFeatures.Reply);
        Assert.Equal(0, reply.Used);
    }
}
