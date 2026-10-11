using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RecruiterReply.Controllers;
using RecruiterReply.Entities;
using RecruiterReply.Tests.Testing;

namespace RecruiterReply.Tests.Controllers;

public sealed class ConsentAuditControllerTests
{
    private static ConsentAuditController Create(RecruiterReply.Data.RecruiterReplyDbContext db, string? origin = null)
    {
        var http = new DefaultHttpContext();
        if (origin is not null) http.Request.Headers.Origin = origin;
        return new ConsentAuditController(db) { ControllerContext = new ControllerContext { HttpContext = http } };
    }

    [Theory]
    [InlineData("reject", false)]
    [InlineData("withdraw", false)]
    [InlineData("accept", true)]
    [InlineData("customize", false)]
    public async Task PersistsServerTimestampAndOnlyPseudonymousFields(string action, bool enabled)
    {
        using var db = TestDb.Create();
        var id = Guid.NewGuid();
        var consent = Guid.NewGuid();
        var before = DateTime.UtcNow;
        var result = await Create(db).Record(new(id, consent, action, enabled, 1), CancellationToken.None);
        Assert.IsType<NoContentResult>(result);
        var saved = await db.ConsentAuditEvents.SingleAsync();
        Assert.Equal(id, saved.EventId);
        Assert.Equal(consent, saved.ConsentId);
        Assert.Equal(action, saved.Action);
        Assert.InRange(saved.CreatedAt, before, DateTime.UtcNow);
        Assert.DoesNotContain(typeof(ConsentAuditEventEntity).GetProperties(), p =>
            new[] { "IpAddress", "Email", "UserAgent", "UserId", "Message" }.Contains(p.Name));
    }

    [Fact]
    public async Task ExactRetryIsIdempotentButConflictingRetryIsRejected()
    {
        using var db = TestDb.Create();
        var id = Guid.NewGuid();
        var consent = Guid.NewGuid();
        var controller = Create(db);
        Assert.IsType<NoContentResult>(await controller.Record(new(id, consent, "accept", true, 1), default));
        Assert.IsType<NoContentResult>(await controller.Record(new(id, consent, "accept", true, 1), default));
        Assert.IsType<ConflictResult>(await controller.Record(new(id, consent, "reject", false, 1), default));
        Assert.Equal(1, await db.ConsentAuditEvents.CountAsync());
    }

    [Fact]
    public async Task WithdrawalAppendsHistoryRatherThanOverwritingConsent()
    {
        using var db = TestDb.Create();
        var consent = Guid.NewGuid();
        var controller = Create(db);
        await controller.Record(new(Guid.NewGuid(), consent, "accept", true, 1), default);
        await controller.Record(new(Guid.NewGuid(), consent, "withdraw", false, 1), default);
        var events = await db.ConsentAuditEvents.OrderBy(e => e.CreatedAt).ToListAsync();
        Assert.Equal(2, events.Count);
        Assert.Contains(events, e => e.Action == "accept" && e.AnalyticsEnabled);
        Assert.Contains(events, e => e.Action == "withdraw" && !e.AnalyticsEnabled);
    }

    [Theory]
    [InlineData("withdraw", true)]
    [InlineData("reject", true)]
    [InlineData("invalid", false)]
    public async Task RejectsInvalidConsentTransitions(string action, bool enabled)
    {
        using var db = TestDb.Create();
        Assert.IsType<BadRequestResult>(await Create(db).Record(
            new(Guid.NewGuid(), Guid.NewGuid(), action, enabled, 1), default));
        Assert.Empty(db.ConsentAuditEvents);
    }

    [Fact]
    public async Task RejectsEmptyIdentifiersAndUnknownPolicyVersion()
    {
        using var db = TestDb.Create();
        var controller = Create(db);
        Assert.IsType<BadRequestResult>(await controller.Record(new(Guid.Empty, Guid.NewGuid(), "accept", true, 1), default));
        Assert.IsType<BadRequestResult>(await controller.Record(new(Guid.NewGuid(), Guid.Empty, "accept", true, 1), default));
        Assert.IsType<BadRequestResult>(await controller.Record(new(Guid.NewGuid(), Guid.NewGuid(), "accept", true, 99), default));
    }

    [Fact]
    public async Task UntrustedBrowserOriginIsForbiddenWithoutPersisting()
    {
        using var db = TestDb.Create();
        var result = await Create(db, "https://attacker.example").Record(
            new(Guid.NewGuid(), Guid.NewGuid(), "accept", true, 1), default);
        Assert.Equal(403, Assert.IsType<StatusCodeResult>(result).StatusCode);
        Assert.Empty(db.ConsentAuditEvents);
    }

    [Fact]
    public async Task FirstPartyOriginCanSubmit()
    {
        using var db = TestDb.Create();
        var result = await Create(db, "https://dev.recruiterreply.com").Record(
            new(Guid.NewGuid(), Guid.NewGuid(), "reject", false, 1), default);
        Assert.IsType<NoContentResult>(result);
    }
}
