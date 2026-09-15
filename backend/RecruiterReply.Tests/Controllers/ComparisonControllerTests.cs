using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using RecruiterReply.Controllers;
using RecruiterReply.Models;
using RecruiterReply.Services;
using RecruiterReply.Tests.Testing;

namespace RecruiterReply.Tests.Controllers;

public class ComparisonControllerTests
{
    private readonly Mock<IComparisonService> _service = new();
    private readonly ComparisonController _sut;
    private readonly Guid _userId = Guid.NewGuid();

    public ComparisonControllerTests()
    {
        _sut = new ComparisonController(_service.Object, NullLogger<ComparisonController>.Instance);
        _sut.SetUser(_userId);
    }

    private static CompareOffersRequest BuildRequest() => new() { OfferOne = new JobOffer(), OfferTwo = new JobOffer() };

    [Fact]
    public async Task CompareOffers_OnSuccess_Returns200WithResult()
    {
        var response = new CompareOffersResponse { BestOffer = "Offer One" };
        _service.Setup(s => s.CompareOffersAsync(It.IsAny<CompareOffersRequest>(), _userId)).ReturnsAsync(response);

        var result = await _sut.CompareOffers(BuildRequest());

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Same(response, ok.Value);
    }

    [Fact]
    public async Task CompareOffers_OnArgumentException_Returns400()
    {
        _service.Setup(s => s.CompareOffersAsync(It.IsAny<CompareOffersRequest>(), _userId)).ThrowsAsync(new ArgumentException("bad"));

        var result = await _sut.CompareOffers(BuildRequest());

        Assert.Equal(400, Assert.IsType<BadRequestObjectResult>(result).StatusCode);
    }

    [Fact]
    public async Task CompareOffers_OnQuotaExceeded_Returns402()
    {
        _service.Setup(s => s.CompareOffersAsync(It.IsAny<CompareOffersRequest>(), _userId))
            .ThrowsAsync(new QuotaExceededException("limit reached"));

        var result = await _sut.CompareOffers(BuildRequest());

        Assert.Equal(402, Assert.IsType<ObjectResult>(result).StatusCode);
    }

    [Fact]
    public async Task CompareOffers_OnInvalidOperationException_Returns502()
    {
        _service.Setup(s => s.CompareOffersAsync(It.IsAny<CompareOffersRequest>(), _userId))
            .ThrowsAsync(new InvalidOperationException("down"));

        var result = await _sut.CompareOffers(BuildRequest());

        Assert.Equal(502, Assert.IsType<ObjectResult>(result).StatusCode);
    }

    [Fact]
    public async Task CompareOffers_OnUnhandledException_Returns500()
    {
        _service.Setup(s => s.CompareOffersAsync(It.IsAny<CompareOffersRequest>(), _userId)).ThrowsAsync(new Exception("boom"));

        var result = await _sut.CompareOffers(BuildRequest());

        Assert.Equal(500, Assert.IsType<ObjectResult>(result).StatusCode);
    }
}
