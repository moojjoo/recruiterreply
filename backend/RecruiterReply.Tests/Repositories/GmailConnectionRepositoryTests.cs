using RecruiterReply.Entities;
using RecruiterReply.Repositories;
using RecruiterReply.Tests.Testing;

namespace RecruiterReply.Tests.Repositories;

public class GmailConnectionRepositoryTests
{
    private static GmailConnectionEntity BuildConnection(Guid userId, string status = "active") => new()
    {
        Id = Guid.NewGuid(),
        UserId = userId,
        Status = status,
        GoogleAccountEmail = "user@example.com",
        AccessTokenEncrypted = "enc",
        RefreshTokenEncrypted = "enc",
        GrantedScopes = "scope",
    };

    [Fact]
    public async Task GetByUserIdAsync_WithMatch_ReturnsConnection()
    {
        await using var db = TestDb.Create();
        var repo = new GmailConnectionRepository(db);
        var userId = Guid.NewGuid();
        var connection = BuildConnection(userId);
        await repo.AddAsync(connection);

        var found = await repo.GetByUserIdAsync(userId);

        Assert.NotNull(found);
        Assert.Equal(connection.Id, found!.Id);
    }

    [Fact]
    public async Task GetByUserIdAsync_WithNoMatch_ReturnsNull()
    {
        await using var db = TestDb.Create();
        var repo = new GmailConnectionRepository(db);

        var found = await repo.GetByUserIdAsync(Guid.NewGuid());

        Assert.Null(found);
    }

    [Fact]
    public async Task GetActiveConnectionsAsync_ReturnsOnlyActiveOnes()
    {
        await using var db = TestDb.Create();
        var repo = new GmailConnectionRepository(db);
        await repo.AddAsync(BuildConnection(Guid.NewGuid(), status: "active"));
        await repo.AddAsync(BuildConnection(Guid.NewGuid(), status: "active"));
        await repo.AddAsync(BuildConnection(Guid.NewGuid(), status: "disconnected"));
        await repo.AddAsync(BuildConnection(Guid.NewGuid(), status: "error"));

        var active = await repo.GetActiveConnectionsAsync();

        Assert.Equal(2, active.Count);
        Assert.All(active, c => Assert.Equal("active", c.Status));
    }

    [Fact]
    public async Task GetActiveConnectionsAsync_WithNoConnections_ReturnsEmptyList()
    {
        await using var db = TestDb.Create();
        var repo = new GmailConnectionRepository(db);

        var active = await repo.GetActiveConnectionsAsync();

        Assert.Empty(active);
    }
}
