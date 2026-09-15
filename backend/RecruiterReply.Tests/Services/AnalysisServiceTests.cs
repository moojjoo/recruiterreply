using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using RecruiterReply.Models;
using RecruiterReply.Services;
using RecruiterReply.Tests.Testing;

namespace RecruiterReply.Tests.Services;

public class AnalysisServiceTests
{
    private readonly Mock<IOpenAIService> _openAI = new();
    private readonly Mock<IUsageService> _usage = new();

    private const string ValidOpenAiJson = """
        {
          "compensationMentioned": "$150k",
          "jobType": "W2",
          "redFlags": ["vague title"],
          "questionsToAsk": ["What is the team size?"],
          "suggestedResponse": "Thanks, I'm interested.",
          "opportunityScore": 80
        }
        """;

    [Fact]
    public async Task AnalyzeRecruiterMessageAsync_WithEmptyMessage_ThrowsArgumentException()
    {
        await using var db = TestDb.Create();
        var sut = new AnalysisService(_openAI.Object, NullLogger<AnalysisService>.Instance, db, _usage.Object);

        await Assert.ThrowsAsync<ArgumentException>(() =>
            sut.AnalyzeRecruiterMessageAsync(new AnalyzeMessageRequest { RecruiterMessage = "  " }, Guid.NewGuid()));
    }

    [Fact]
    public async Task AnalyzeRecruiterMessageAsync_WhenQuotaExceeded_PropagatesWithoutCallingOpenAI()
    {
        await using var db = TestDb.Create();
        _usage.Setup(u => u.EnsureWithinQuotaAsync(It.IsAny<Guid>(), UsageFeatures.Analyze, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new QuotaExceededException("limit reached"));
        var sut = new AnalysisService(_openAI.Object, NullLogger<AnalysisService>.Instance, db, _usage.Object);

        await Assert.ThrowsAsync<QuotaExceededException>(() =>
            sut.AnalyzeRecruiterMessageAsync(new AnalyzeMessageRequest { RecruiterMessage = "hello" }, Guid.NewGuid()));

        _openAI.Verify(o => o.AnalyzeRecruiterMessageAsync(It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<string?>()), Times.Never);
        _usage.Verify(u => u.IncrementUsageAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task AnalyzeRecruiterMessageAsync_OnSuccess_PersistsMessageAndAnalysisAndIncrementsUsage()
    {
        await using var db = TestDb.Create();
        var userId = Guid.NewGuid();
        _openAI.Setup(o => o.AnalyzeRecruiterMessageAsync("hello", "Acme", "Engineer")).ReturnsAsync(ValidOpenAiJson);
        var sut = new AnalysisService(_openAI.Object, NullLogger<AnalysisService>.Instance, db, _usage.Object);

        var result = await sut.AnalyzeRecruiterMessageAsync(
            new AnalyzeMessageRequest { RecruiterMessage = "hello", CompanyName = "Acme", JobTitle = "Engineer" },
            userId);

        Assert.Equal("$150k", result.CompensationMentioned);
        Assert.Equal(80, result.OpportunityScore);
        Assert.Single(db.Messages);
        Assert.Single(db.MessageAnalyses);
        Assert.Equal(userId, db.Messages.Single().UserId);
        _usage.Verify(u => u.IncrementUsageAsync(userId, UsageFeatures.Analyze, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task AnalyzeRecruiterMessageAsync_WhenOpenAiFails_DoesNotIncrementUsage()
    {
        await using var db = TestDb.Create();
        _openAI.Setup(o => o.AnalyzeRecruiterMessageAsync(It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<string?>()))
            .ThrowsAsync(new InvalidOperationException("OpenAI down"));
        var sut = new AnalysisService(_openAI.Object, NullLogger<AnalysisService>.Instance, db, _usage.Object);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            sut.AnalyzeRecruiterMessageAsync(new AnalyzeMessageRequest { RecruiterMessage = "hello" }, Guid.NewGuid()));

        _usage.Verify(u => u.IncrementUsageAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }
}
