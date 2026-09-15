using RecruiterReply.Services;
using RecruiterReply.Tests.Testing;

namespace RecruiterReply.Tests.Services;

public class DefaultUserServiceTests
{
    [Fact]
    public async Task GetOrCreateDefaultUserIdAsync_OnFirstCall_CreatesUser()
    {
        await using var db = TestDb.Create();
        var sut = new DefaultUserService(db);

        var userId = await sut.GetOrCreateDefaultUserIdAsync();

        var user = await db.Users.FindAsync(userId);
        Assert.NotNull(user);
        Assert.Equal("local@recruiterreply.dev", user!.Email);
    }

    [Fact]
    public async Task GetOrCreateDefaultUserIdAsync_OnSecondCall_ReturnsSameUserWithoutDuplicating()
    {
        await using var db = TestDb.Create();
        var sut = new DefaultUserService(db);

        var first = await sut.GetOrCreateDefaultUserIdAsync();
        var second = await sut.GetOrCreateDefaultUserIdAsync();

        Assert.Equal(first, second);
        Assert.Equal(1, db.Users.Count());
    }
}
