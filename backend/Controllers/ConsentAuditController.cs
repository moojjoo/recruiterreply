using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using RecruiterReply.Data;
using RecruiterReply.Entities;

namespace RecruiterReply.Controllers;

public sealed record ConsentAuditRequest(Guid EventId, Guid ConsentId, string Action, bool AnalyticsEnabled, int PolicyVersion);

[ApiController]
[AllowAnonymous]
[Route("api/consent-events")]
[EnableRateLimiting("consent-audit")]
public sealed class ConsentAuditController(RecruiterReplyDbContext db) : ControllerBase
{
    [HttpPost]
    [RequestSizeLimit(1024)]
    public async Task<IActionResult> Record([FromBody] ConsentAuditRequest request, CancellationToken ct)
    {
        if (request.EventId == Guid.Empty || request.ConsentId == Guid.Empty ||
            request.PolicyVersion != 1 ||
            request.Action is not ("accept" or "reject" or "customize" or "withdraw") ||
            (request.Action is "reject" or "withdraw" && request.AnalyticsEnabled))
            return BadRequest();

        // Idempotent by event ID. No account IDs, IPs, emails or user-agent are stored.
        // A collision with another payload does not overwrite the original audit event.
        var existing = await db.ConsentAuditEvents.AsNoTracking()
            .FirstOrDefaultAsync(e => e.EventId == request.EventId, ct);
        if (existing is not null)
            return existing.ConsentId == request.ConsentId && existing.Action == request.Action &&
                   existing.AnalyticsEnabled == request.AnalyticsEnabled && existing.PolicyVersion == request.PolicyVersion
                ? NoContent() : Conflict();

        db.ConsentAuditEvents.Add(new ConsentAuditEventEntity
        {
            EventId = request.EventId,
            ConsentId = request.ConsentId,
            Action = request.Action,
            AnalyticsEnabled = request.AnalyticsEnabled,
            PolicyVersion = request.PolicyVersion,
            CreatedAt = DateTime.UtcNow
        });
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException)
        {
            // Concurrent duplicate submission is safe; other database failures propagate.
            db.ChangeTracker.Clear();
            var duplicate = await db.ConsentAuditEvents.AsNoTracking()
                .FirstOrDefaultAsync(e => e.EventId == request.EventId, ct);
            if (duplicate is null) throw;
            return duplicate.ConsentId == request.ConsentId && duplicate.Action == request.Action &&
                   duplicate.AnalyticsEnabled == request.AnalyticsEnabled && duplicate.PolicyVersion == request.PolicyVersion
                ? NoContent() : Conflict();
        }
        return NoContent();
    }
}
