using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using RecruiterReply.Models;
using RecruiterReply.Services;
using RecruiterReply.Tests.Testing;

namespace RecruiterReply.Tests.Services;

public class ReplyServiceTests
{
    private readonly Mock<IOpenAIService> _openAI = new();
    private readonly Mock<IUsageService> _usage = new();

    private ReplyService CreateSut(RecruiterReply.Data.RecruiterReplyDbContext db) =>
        new(_openAI.Object, NullLogger<ReplyService>.Instance, db, _usage.Object);

    [Fact]
    public async Task GenerateReplyAsync_WithEmptyMessage_Throws()
    {
        await using var db = TestDb.Create();
        var sut = CreateSut(db);

        await Assert.ThrowsAsync<ArgumentException>(() =>
            sut.GenerateReplyAsync(new GenerateReplyRequest { ReplyType = "interested", RecruiterMessage = " " }, Guid.NewGuid()));
    }

    [Fact]
    public async Task GenerateReplyAsync_WithEmptyReplyType_Throws()
    {
        await using var db = TestDb.Create();
        var sut = CreateSut(db);

        await Assert.ThrowsAsync<ArgumentException>(() =>
            sut.GenerateReplyAsync(new GenerateReplyRequest { ReplyType = "", RecruiterMessage = "hi" }, Guid.NewGuid()));
    }

    [Fact]
    public async Task GenerateReplyAsync_WhenQuotaExceeded_PropagatesWithoutCallingOpenAI()
    {
        await using var db = TestDb.Create();
        _usage.Setup(u => u.EnsureWithinQuotaAsync(It.IsAny<Guid>(), UsageFeatures.Reply, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new QuotaExceededException("limit reached"));
        var sut = CreateSut(db);

        await Assert.ThrowsAsync<QuotaExceededException>(() =>
            sut.GenerateReplyAsync(new GenerateReplyRequest { ReplyType = "interested", RecruiterMessage = "hi" }, Guid.NewGuid()));

        _openAI.Verify(o => o.GenerateReplyAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<decimal?>(), It.IsAny<string?>(), It.IsAny<string?>()), Times.Never);
    }

    [Fact]
    public async Task GenerateReplyAsync_OnSuccess_PersistsGeneratedReplyAndIncrementsUsage()
    {
        await using var db = TestDb.Create();
        var userId = Guid.NewGuid();
        _openAI.Setup(o => o.GenerateReplyAsync("interested", "hi", null, null, null)).ReturnsAsync("Thanks, I'm interested!");
        var sut = CreateSut(db);

        var result = await sut.GenerateReplyAsync(
            new GenerateReplyRequest { ReplyType = "interested", RecruiterMessage = "hi" }, userId);

        Assert.Equal("Thanks, I'm interested!", result.Reply);
        Assert.Equal("Enthusiastic", result.Tone);
        Assert.Single(db.GeneratedReplies);
        Assert.Equal(userId, db.GeneratedReplies.Single().UserId);
        _usage.Verify(u => u.IncrementUsageAsync(userId, UsageFeatures.Reply, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Theory]
    [InlineData("interested", "Enthusiastic")]
    [InlineData("request_pay_range", "Professional")]
    [InlineData("counteroffer", "Confident")]
    [InlineData("decline", "Polite")]
    [InlineData("followup", "Proactive")]
    [InlineData("something_else", "Professional")]
    public async Task GenerateReplyAsync_MapsReplyTypeToExpectedTone(string replyType, string expectedTone)
    {
        await using var db = TestDb.Create();
        _openAI.Setup(o => o.GenerateReplyAsync(replyType, "hi", null, null, null)).ReturnsAsync("reply body");
        var sut = CreateSut(db);

        var result = await sut.GenerateReplyAsync(new GenerateReplyRequest { ReplyType = replyType, RecruiterMessage = "hi" }, Guid.NewGuid());

        Assert.Equal(expectedTone, result.Tone);
    }
}
