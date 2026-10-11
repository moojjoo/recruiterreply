using Microsoft.EntityFrameworkCore;
using RecruiterReply.Controllers;
using RecruiterReply.Data;
using RecruiterReply.Entities;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace RecruiterReply.Tests.Integration;

// Runs only with an explicitly provided, disposable PostgreSQL database.
// Never point CONSENT_AUDIT_TEST_DATABASE_URL at a shared environment.
public sealed class ConsentAuditPostgresTests
{
    [Fact]
    public async Task MigrationPersistenceIdempotencyWithdrawalAndRetentionWorkOnPostgres()
    {
        var connection = Environment.GetEnvironmentVariable("CONSENT_AUDIT_TEST_DATABASE_URL");
        if (string.IsNullOrWhiteSpace(connection)) return;

        var options = new DbContextOptionsBuilder<RecruiterReplyDbContext>()
            .UseNpgsql(connection).Options;
        await using var db = new RecruiterReplyDbContext(options);
        await db.Database.MigrateAsync();

        var migrations = await db.Database.GetAppliedMigrationsAsync();
        Assert.Contains(migrations, m => m.Contains("AddConsentAuditEvents"));

        var consentId = Guid.NewGuid();
        var acceptedId = Guid.NewGuid();
        var withdrawnId = Guid.NewGuid();
        var expiredId = Guid.NewGuid();
        var http = new DefaultHttpContext();
        http.Request.Headers.Origin = "https://dev.recruiterreply.com";
        var controller = new ConsentAuditController(db)
        {
            ControllerContext = new ControllerContext { HttpContext = http }
        };

        try
        {
            Assert.IsType<NoContentResult>(await controller.Record(
                new ConsentAuditRequest(acceptedId, consentId, "accept", true, 1), default));
            Assert.IsType<NoContentResult>(await controller.Record(
                new ConsentAuditRequest(acceptedId, consentId, "accept", true, 1), default));
            Assert.IsType<ConflictResult>(await controller.Record(
                new ConsentAuditRequest(acceptedId, consentId, "reject", false, 1), default));
            Assert.IsType<NoContentResult>(await controller.Record(
                new ConsentAuditRequest(withdrawnId, consentId, "withdraw", false, 1), default));

            var history = await db.ConsentAuditEvents.AsNoTracking()
                .Where(e => e.ConsentId == consentId).ToListAsync();
            Assert.Equal(2, history.Count);
            Assert.Contains(history, e => e.Action == "accept" && e.AnalyticsEnabled);
            Assert.Contains(history, e => e.Action == "withdraw" && !e.AnalyticsEnabled);

            db.ConsentAuditEvents.Add(new ConsentAuditEventEntity
            {
                EventId = expiredId,
                ConsentId = Guid.NewGuid(),
                Action = "reject",
                AnalyticsEnabled = false,
                PolicyVersion = 1,
                CreatedAt = DateTime.UtcNow.AddDays(-400)
            });
            await db.SaveChangesAsync();

            var cutoff = DateTime.UtcNow.AddDays(-365);
            var deleted = await db.ConsentAuditEvents
                .Where(e => e.CreatedAt < cutoff)
                .ExecuteDeleteAsync();
            Assert.Equal(1, deleted);
            Assert.False(await db.ConsentAuditEvents.AnyAsync(e => e.EventId == expiredId));
            Assert.Equal(2, await db.ConsentAuditEvents.CountAsync(e => e.ConsentId == consentId));
        }
        finally
        {
            await db.ConsentAuditEvents
                .Where(e => e.EventId == acceptedId || e.EventId == withdrawnId || e.EventId == expiredId)
                .ExecuteDeleteAsync();
        }
    }
}
