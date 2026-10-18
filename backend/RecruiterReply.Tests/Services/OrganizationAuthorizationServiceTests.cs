using RecruiterReply.Data;
using RecruiterReply.Entities;
using RecruiterReply.Services;
using RecruiterReply.Tests.Testing;

namespace RecruiterReply.Tests.Services;

public sealed class OrganizationAuthorizationServiceTests
{
    [Fact]
    public async Task InactiveMembershipIsDenied()
    {
        await using var db = TestDb.Create();
        var userId = Guid.NewGuid();
        var organizationId = Guid.NewGuid();
        db.OrganizationMembers.Add(new OrganizationMemberEntity
        {
            UserId = userId, OrganizationId = organizationId, Role = "owner", Status = "revoked"
        });
        await db.SaveChangesAsync();

        var sut = new OrganizationAuthorizationService(db);

        Assert.False(await sut.IsActiveMemberAsync(userId, organizationId));
        Assert.False(await sut.CanAccessAsync(userId, organizationId));
    }

    [Fact]
    public async Task MembershipRoleCannotExceedItsGrantedRole()
    {
        await using var db = TestDb.Create();
        var userId = Guid.NewGuid();
        var organizationId = Guid.NewGuid();
        db.OrganizationMembers.Add(new OrganizationMemberEntity
        {
            UserId = userId, OrganizationId = organizationId, Role = "member", Status = "active"
        });
        await db.SaveChangesAsync();

        var sut = new OrganizationAuthorizationService(db);

        Assert.True(await sut.CanAccessAsync(userId, organizationId, "member"));
        Assert.False(await sut.CanAccessAsync(userId, organizationId, "admin"));
    }

    [Fact]
    public async Task OwnerCannotEscalateToGlobalAdminOperations()
    {
        await using var db = TestDb.Create();
        var userId = Guid.NewGuid();
        var organizationId = Guid.NewGuid();
        db.OrganizationMembers.Add(new OrganizationMemberEntity
        {
            UserId = userId, OrganizationId = organizationId, Role = "owner", Status = "active"
        });
        await db.SaveChangesAsync();

        var sut = new OrganizationAuthorizationService(db);

        Assert.True(await sut.CanAccessAsync(userId, organizationId, "member"));
        Assert.False(await sut.CanAccessAsync(userId, organizationId, "admin"));
    }
}
