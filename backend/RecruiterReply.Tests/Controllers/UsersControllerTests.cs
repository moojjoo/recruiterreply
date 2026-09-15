using Microsoft.AspNetCore.Mvc;
using RecruiterReply.Controllers;
using RecruiterReply.Entities;
using RecruiterReply.Tests.Testing;

namespace RecruiterReply.Tests.Controllers;

public class UsersControllerTests
{
    private readonly RecruiterReply.Data.RecruiterReplyDbContext _db = TestDb.Create();
    private readonly UsersController _sut;
    private readonly Guid _userId = Guid.NewGuid();

    public UsersControllerTests()
    {
        _sut = new UsersController(_db);
        _sut.SetUser(_userId);
    }

    private async Task SeedUser(Guid id, string email)
    {
        _db.Users.Add(new UserEntity
        {
            Id = id, Email = email, PasswordHash = "hash", IsActive = true,
            CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync();
    }

    [Fact]
    public async Task GetUsers_ReturnsOnlyTheAuthenticatedUser()
    {
        await SeedUser(_userId, "me@example.com");
        await SeedUser(Guid.NewGuid(), "someoneelse@example.com");

        var result = await _sut.GetUsers(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var list = Assert.IsAssignableFrom<System.Collections.IEnumerable>(ok.Value).Cast<object>().ToList();
        Assert.Single(list);
    }

    [Fact]
    public async Task GetMe_WithExistingUser_ReturnsIt()
    {
        await SeedUser(_userId, "me@example.com");

        var result = await _sut.GetMe(CancellationToken.None);

        Assert.IsType<OkObjectResult>(result);
    }

    [Fact]
    public async Task GetMe_WithNoMatchingUser_Throws()
    {
        // Documents current behavior: GetMe uses FirstAsync (not FirstOrDefaultAsync), so a
        // caller whose row is missing gets an unhandled exception rather than a 404.
        await Assert.ThrowsAsync<InvalidOperationException>(() => _sut.GetMe(CancellationToken.None));
    }
}
