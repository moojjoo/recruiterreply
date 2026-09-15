using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using RecruiterReply.Models;
using RecruiterReply.Services;
using RecruiterReply.Tests.Testing;

namespace RecruiterReply.Tests.Services;

public class ComparisonServiceTests
{
    private readonly Mock<IOpenAIService> _openAI = new();
    private readonly Mock<IUsageService> _usage = new();

    private const string ValidOpenAiJson = """
        {
          "estimatedAnnualValueOne": 180000,
          "estimatedAnnualValueTwo": 165000,
          "prosOne": ["higher pay"],
          "prosTwo": ["better benefits"],
          "consOne": [],
          "consTwo": [],
          "riskLevelOne": "low",
          "riskLevelTwo": "medium",
          "recommendation": "Take offer one",
          "bestOffer": "Offer One"
        }
        """;

    private static CompareOffersRequest BuildRequest() => new()
    {
        OfferOne = new JobOffer { Company = "Acme", JobTitle = "Engineer", Salary = 180000 },
        OfferTwo = new JobOffer { Company = "Globex", JobTitle = "Engineer", Salary = 165000 },
    };

    private ComparisonService CreateSut(RecruiterReply.Data.RecruiterReplyDbContext db) =>
        new(_openAI.Object, NullLogger<ComparisonService>.Instance, db, _usage.Object);

    [Fact]
    public async Task CompareOffersAsync_WithMissingOffer_Throws()
    {
        await using var db = TestDb.Create();
        var sut = CreateSut(db);

        await Assert.ThrowsAsync<ArgumentException>(() =>
            sut.CompareOffersAsync(new CompareOffersRequest { OfferOne = null!, OfferTwo = new JobOffer() }, Guid.NewGuid()));
    }

    [Fact]
    public async Task CompareOffersAsync_WhenQuotaExceeded_PropagatesWithoutCallingOpenAI()
    {
        await using var db = TestDb.Create();
        _usage.Setup(u => u.EnsureWithinQuotaAsync(It.IsAny<Guid>(), UsageFeatures.Compare, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new QuotaExceededException("limit reached"));
        var sut = CreateSut(db);

        await Assert.ThrowsAsync<QuotaExceededException>(() => sut.CompareOffersAsync(BuildRequest(), Guid.NewGuid()));

        _openAI.Verify(o => o.CompareOffersAsync(It.IsAny<string>(), It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task CompareOffersAsync_OnSuccess_PersistsComparisonAndItemsAndIncrementsUsage()
    {
        await using var db = TestDb.Create();
        var userId = Guid.NewGuid();
        _openAI.Setup(o => o.CompareOffersAsync(It.IsAny<string>(), It.IsAny<string>())).ReturnsAsync(ValidOpenAiJson);
        var sut = CreateSut(db);

        var result = await sut.CompareOffersAsync(BuildRequest(), userId);

        Assert.Equal("Offer One", result.BestOffer);
        Assert.Equal(180000, result.EstimatedAnnualValueOne);
        Assert.Single(db.OfferComparisons);
        Assert.Equal(userId, db.OfferComparisons.Single().UserId);
        Assert.Equal("Acme vs Globex", db.OfferComparisons.Single().Title);
        Assert.Equal(2, db.ComparisonItems.Count());
        _usage.Verify(u => u.IncrementUsageAsync(userId, UsageFeatures.Compare, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task CompareOffersAsync_WhenOpenAiFails_DoesNotIncrementUsage()
    {
        await using var db = TestDb.Create();
        _openAI.Setup(o => o.CompareOffersAsync(It.IsAny<string>(), It.IsAny<string>()))
            .ThrowsAsync(new InvalidOperationException("OpenAI down"));
        var sut = CreateSut(db);

        await Assert.ThrowsAsync<InvalidOperationException>(() => sut.CompareOffersAsync(BuildRequest(), Guid.NewGuid()));

        _usage.Verify(u => u.IncrementUsageAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }
}
