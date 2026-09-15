using RecruiterReply.Entities;
using RecruiterReply.Repositories;
using RecruiterReply.Tests.Testing;

namespace RecruiterReply.Tests.Repositories;

public class UserRepositoryTests
{
    private static UserEntity BuildUser(string email = "jane@example.com") => new()
    {
        Id = Guid.NewGuid(),
        Email = email,
        PasswordHash = "hash",
        IsActive = true,
        CreatedAt = DateTime.UtcNow,
        UpdatedAt = DateTime.UtcNow,
    };

    // ----- Base EfRepository<T> CRUD, exercised once via UserRepository -----

    [Fact]
    public async Task AddAsync_ThenGetByIdAsync_ReturnsTheEntity()
    {
        await using var db = TestDb.Create();
        var repo = new UserRepository(db);
        var user = BuildUser();

        await repo.AddAsync(user);
        var found = await repo.GetByIdAsync(user.Id);

        Assert.NotNull(found);
        Assert.Equal(user.Email, found!.Email);
    }

    [Fact]
    public async Task GetByIdAsync_WithUnknownId_ReturnsNull()
    {
        await using var db = TestDb.Create();
        var repo = new UserRepository(db);

        var found = await repo.GetByIdAsync(Guid.NewGuid());

        Assert.Null(found);
    }

    [Fact]
    public async Task GetAllAsync_ReturnsEveryEntity()
    {
        await using var db = TestDb.Create();
        var repo = new UserRepository(db);
        await repo.AddAsync(BuildUser("a@example.com"));
        await repo.AddAsync(BuildUser("b@example.com"));

        var all = await repo.GetAllAsync();

        Assert.Equal(2, all.Count);
    }

    [Fact]
    public async Task FindAsync_FiltersByPredicate()
    {
        await using var db = TestDb.Create();
        var repo = new UserRepository(db);
        await repo.AddAsync(BuildUser("active@example.com"));
        var inactive = BuildUser("inactive@example.com");
        inactive.IsActive = false;
        await repo.AddAsync(inactive);

        var active = await repo.FindAsync(u => u.IsActive);

        Assert.Single(active);
        Assert.Equal("active@example.com", active[0].Email);
    }

    [Fact]
    public async Task UpdateAsync_PersistsChanges()
    {
        await using var db = TestDb.Create();
        var repo = new UserRepository(db);
        var user = BuildUser();
        await repo.AddAsync(user);

        user.FirstName = "Updated";
        await repo.UpdateAsync(user);

        var found = await repo.GetByIdAsync(user.Id);
        Assert.Equal("Updated", found!.FirstName);
    }

    [Fact]
    public async Task DeleteAsync_RemovesTheEntity()
    {
        await using var db = TestDb.Create();
        var repo = new UserRepository(db);
        var user = BuildUser();
        await repo.AddAsync(user);

        await repo.DeleteAsync(user);

        Assert.Null(await repo.GetByIdAsync(user.Id));
    }

    [Fact]
    public async Task AsQueryable_SupportsFurtherLinqComposition()
    {
        await using var db = TestDb.Create();
        var repo = new UserRepository(db);
        await repo.AddAsync(BuildUser("a@example.com"));
        await repo.AddAsync(BuildUser("b@example.com"));

        var count = repo.AsQueryable().Count(u => u.Email.StartsWith("a"));

        Assert.Equal(1, count);
    }

    // ----- UserRepository-specific queries -----

    [Fact]
    public async Task GetByEmailAsync_WithMatchingEmail_ReturnsUser()
    {
        await using var db = TestDb.Create();
        var repo = new UserRepository(db);
        var user = BuildUser("match@example.com");
        await repo.AddAsync(user);

        var found = await repo.GetByEmailAsync("match@example.com");

        Assert.NotNull(found);
        Assert.Equal(user.Id, found!.Id);
    }

    [Fact]
    public async Task GetByEmailAsync_WithNoMatch_ReturnsNull()
    {
        await using var db = TestDb.Create();
        var repo = new UserRepository(db);

        var found = await repo.GetByEmailAsync("nobody@example.com");

        Assert.Null(found);
    }

    [Fact]
    public async Task GetByStripeCustomerIdAsync_WithMatch_ReturnsUser()
    {
        await using var db = TestDb.Create();
        var repo = new UserRepository(db);
        var user = BuildUser();
        user.StripeCustomerId = "cus_123";
        await repo.AddAsync(user);

        var found = await repo.GetByStripeCustomerIdAsync("cus_123");

        Assert.NotNull(found);
        Assert.Equal(user.Id, found!.Id);
    }

    [Fact]
    public async Task GetByStripeCustomerIdAsync_WithNoMatch_ReturnsNull()
    {
        await using var db = TestDb.Create();
        var repo = new UserRepository(db);

        var found = await repo.GetByStripeCustomerIdAsync("cus_unknown");

        Assert.Null(found);
    }
}
