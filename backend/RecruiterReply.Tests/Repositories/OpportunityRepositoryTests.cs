using RecruiterReply.Entities;
using RecruiterReply.Repositories;
using RecruiterReply.Tests.Testing;

namespace RecruiterReply.Tests.Repositories;

public class OpportunityRepositoryTests
{
    [Fact]
    public async Task GetByUserIdAsync_ReturnsOnlyThatUsersOpportunitiesNewestFirst()
    {
        await using var db = TestDb.Create();
        var repo = new OpportunityRepository(db);
        var userId = Guid.NewGuid();

        var older = new OpportunityEntity
        {
            Id = Guid.NewGuid(), UserId = userId, CompanyName = "Old Co", PositionTitle = "Eng",
            Status = "lead", CreatedAt = DateTime.UtcNow.AddDays(-1), UpdatedAt = DateTime.UtcNow,
        };
        var newer = new OpportunityEntity
        {
            Id = Guid.NewGuid(), UserId = userId, CompanyName = "New Co", PositionTitle = "Eng",
            Status = "lead", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow,
        };
        var others = new OpportunityEntity
        {
            Id = Guid.NewGuid(), UserId = Guid.NewGuid(), CompanyName = "Not Mine", PositionTitle = "Eng",
            Status = "lead", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow,
        };
        await repo.AddAsync(older);
        await repo.AddAsync(newer);
        await repo.AddAsync(others);

        var result = await repo.GetByUserIdAsync(userId);

        Assert.Equal(2, result.Count);
        Assert.Equal("New Co", result[0].CompanyName);
    }

    [Fact]
    public async Task GetByUserIdAsync_WithNoOpportunities_ReturnsEmptyList()
    {
        await using var db = TestDb.Create();
        var repo = new OpportunityRepository(db);

        var result = await repo.GetByUserIdAsync(Guid.NewGuid());

        Assert.Empty(result);
    }
}
