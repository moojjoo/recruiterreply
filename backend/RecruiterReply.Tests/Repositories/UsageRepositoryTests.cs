using RecruiterReply.Entities;
using RecruiterReply.Models;
using RecruiterReply.Repositories;
using RecruiterReply.Tests.Testing;

namespace RecruiterReply.Tests.Repositories;

public class UsageRepositoryTests
{
    private static readonly DateTime PeriodStart = new(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc);

    private static UsageRecordEntity BuildRecord(Guid userId, string feature, DateTime periodStart, int count = 1) => new()
    {
        Id = Guid.NewGuid(),
        UserId = userId,
        Feature = feature,
        PeriodStart = periodStart,
        Count = count,
    };

    [Fact]
    public async Task GetForPeriodAsync_SingleFeature_WithMatch_ReturnsRecord()
    {
        await using var db = TestDb.Create();
        var repo = new UsageRepository(db);
        var userId = Guid.NewGuid();
        var record = BuildRecord(userId, UsageFeatures.Analyze, PeriodStart, count: 3);
        await repo.AddAsync(record);

        var found = await repo.GetForPeriodAsync(userId, UsageFeatures.Analyze, PeriodStart);

        Assert.NotNull(found);
        Assert.Equal(3, found!.Count);
    }

    [Fact]
    public async Task GetForPeriodAsync_SingleFeature_WithDifferentPeriod_ReturnsNull()
    {
        await using var db = TestDb.Create();
        var repo = new UsageRepository(db);
        var userId = Guid.NewGuid();
        await repo.AddAsync(BuildRecord(userId, UsageFeatures.Analyze, PeriodStart));

        var found = await repo.GetForPeriodAsync(userId, UsageFeatures.Analyze, PeriodStart.AddMonths(1));

        Assert.Null(found);
    }

    [Fact]
    public async Task GetForPeriodAsync_SingleFeature_WithDifferentFeature_ReturnsNull()
    {
        await using var db = TestDb.Create();
        var repo = new UsageRepository(db);
        var userId = Guid.NewGuid();
        await repo.AddAsync(BuildRecord(userId, UsageFeatures.Analyze, PeriodStart));

        var found = await repo.GetForPeriodAsync(userId, UsageFeatures.Reply, PeriodStart);

        Assert.Null(found);
    }

    [Fact]
    public async Task GetForPeriodAsync_AllFeatures_ReturnsAllRecordsForThatUserAndPeriod()
    {
        await using var db = TestDb.Create();
        var repo = new UsageRepository(db);
        var userId = Guid.NewGuid();
        await repo.AddAsync(BuildRecord(userId, UsageFeatures.Analyze, PeriodStart));
        await repo.AddAsync(BuildRecord(userId, UsageFeatures.Reply, PeriodStart));
        await repo.AddAsync(BuildRecord(userId, UsageFeatures.Compare, PeriodStart.AddMonths(-1)));
        await repo.AddAsync(BuildRecord(Guid.NewGuid(), UsageFeatures.Analyze, PeriodStart));

        var result = await repo.GetForPeriodAsync(userId, PeriodStart);

        Assert.Equal(2, result.Count);
        Assert.Contains(result, r => r.Feature == UsageFeatures.Analyze);
        Assert.Contains(result, r => r.Feature == UsageFeatures.Reply);
    }

    [Fact]
    public async Task GetForPeriodAsync_AllFeatures_WithNoRecords_ReturnsEmptyList()
    {
        await using var db = TestDb.Create();
        var repo = new UsageRepository(db);

        var result = await repo.GetForPeriodAsync(Guid.NewGuid(), PeriodStart);

        Assert.Empty(result);
    }
}
