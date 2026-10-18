using Microsoft.EntityFrameworkCore;
using RecruiterReply.Data;

namespace RecruiterReply.Services;

public interface IOrganizationAuthorizationService
{
    Task<bool> IsActiveMemberAsync(Guid userId, Guid organizationId, CancellationToken cancellationToken = default);
    Task<bool> CanAccessAsync(Guid userId, Guid organizationId, string minimumRole = "member", CancellationToken cancellationToken = default);
}

public sealed class OrganizationAuthorizationService : IOrganizationAuthorizationService
{
    private static readonly IReadOnlyDictionary<string, int> RoleRanks = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)
    {
        ["member"] = 1, ["owner"] = 2, ["admin"] = 3
    };

    private readonly RecruiterReplyDbContext _db;

    public OrganizationAuthorizationService(RecruiterReplyDbContext db) => _db = db;

    public Task<bool> IsActiveMemberAsync(Guid userId, Guid organizationId, CancellationToken cancellationToken = default) =>
        _db.OrganizationMembers.AsNoTracking().AnyAsync(member =>
            member.UserId == userId && member.OrganizationId == organizationId && member.Status == "active", cancellationToken);

    public async Task<bool> CanAccessAsync(Guid userId, Guid organizationId, string minimumRole = "member",
        CancellationToken cancellationToken = default)
    {
        var member = await _db.OrganizationMembers.AsNoTracking().SingleOrDefaultAsync(candidate =>
            candidate.UserId == userId && candidate.OrganizationId == organizationId && candidate.Status == "active", cancellationToken);
        return member is not null && RoleRanks.TryGetValue(member.Role, out var actual)
            && RoleRanks.TryGetValue(minimumRole, out var required) && actual >= required;
    }
}
