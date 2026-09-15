using RecruiterReply.Entities;
using RecruiterReply.Repositories;
using RecruiterReply.Tests.Testing;

namespace RecruiterReply.Tests.Repositories;

public class MessageRepositoryTests
{
    [Fact]
    public async Task GetByUserIdAsync_ReturnsOnlyThatUsersMessagesNewestFirst()
    {
        await using var db = TestDb.Create();
        var repo = new MessageRepository(db);
        var userId = Guid.NewGuid();
        var otherUserId = Guid.NewGuid();

        var older = new MessageEntity { Id = Guid.NewGuid(), UserId = userId, Body = "older", CreatedAt = DateTime.UtcNow.AddHours(-2) };
        var newer = new MessageEntity { Id = Guid.NewGuid(), UserId = userId, Body = "newer", CreatedAt = DateTime.UtcNow };
        var others = new MessageEntity { Id = Guid.NewGuid(), UserId = otherUserId, Body = "not mine", CreatedAt = DateTime.UtcNow };
        await repo.AddAsync(older);
        await repo.AddAsync(newer);
        await repo.AddAsync(others);

        var result = await repo.GetByUserIdAsync(userId);

        Assert.Equal(2, result.Count);
        Assert.Equal("newer", result[0].Body);
        Assert.Equal("older", result[1].Body);
    }

    [Fact]
    public async Task GetByUserIdAsync_WithNoMessages_ReturnsEmptyList()
    {
        await using var db = TestDb.Create();
        var repo = new MessageRepository(db);

        var result = await repo.GetByUserIdAsync(Guid.NewGuid());

        Assert.Empty(result);
    }
}
