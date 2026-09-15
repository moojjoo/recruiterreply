using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using RecruiterReply.Controllers;
using RecruiterReply.Models;
using RecruiterReply.Services;
using RecruiterReply.Tests.Testing;

namespace RecruiterReply.Tests.Controllers;

public class AnalysisControllerTests
{
    private readonly Mock<IAnalysisService> _service = new();
    private readonly AnalysisController _sut;
    private readonly Guid _userId = Guid.NewGuid();

    public AnalysisControllerTests()
    {
        _sut = new AnalysisController(_service.Object, NullLogger<AnalysisController>.Instance);
        _sut.SetUser(_userId);
    }

    [Fact]
    public async Task AnalyzeRecruiterMessage_OnSuccess_Returns200WithResult()
    {
        var response = new AnalyzeMessageResponse { OpportunityScore = 80 };
        _service.Setup(s => s.AnalyzeRecruiterMessageAsync(It.IsAny<AnalyzeMessageRequest>(), _userId)).ReturnsAsync(response);

        var result = await _sut.AnalyzeRecruiterMessage(new AnalyzeMessageRequest { RecruiterMessage = "hi" });

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Same(response, ok.Value);
    }

    [Fact]
    public async Task AnalyzeRecruiterMessage_OnArgumentException_Returns400()
    {
        _service.Setup(s => s.AnalyzeRecruiterMessageAsync(It.IsAny<AnalyzeMessageRequest>(), _userId))
            .ThrowsAsync(new ArgumentException("bad input"));

        var result = await _sut.AnalyzeRecruiterMessage(new AnalyzeMessageRequest());

        Assert.Equal(400, Assert.IsType<BadRequestObjectResult>(result).StatusCode);
    }

    [Fact]
    public async Task AnalyzeRecruiterMessage_OnQuotaExceeded_Returns402WithUpgradeFlag()
    {
        _service.Setup(s => s.AnalyzeRecruiterMessageAsync(It.IsAny<AnalyzeMessageRequest>(), _userId))
            .ThrowsAsync(new QuotaExceededException("limit reached"));

        var result = await _sut.AnalyzeRecruiterMessage(new AnalyzeMessageRequest());

        var objectResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(402, objectResult.StatusCode);
    }

    [Fact]
    public async Task AnalyzeRecruiterMessage_OnInvalidOperationException_Returns502()
    {
        _service.Setup(s => s.AnalyzeRecruiterMessageAsync(It.IsAny<AnalyzeMessageRequest>(), _userId))
            .ThrowsAsync(new InvalidOperationException("openai down"));

        var result = await _sut.AnalyzeRecruiterMessage(new AnalyzeMessageRequest());

        Assert.Equal(502, Assert.IsType<ObjectResult>(result).StatusCode);
    }

    [Fact]
    public async Task AnalyzeRecruiterMessage_OnUnhandledException_Returns500()
    {
        _service.Setup(s => s.AnalyzeRecruiterMessageAsync(It.IsAny<AnalyzeMessageRequest>(), _userId))
            .ThrowsAsync(new Exception("boom"));

        var result = await _sut.AnalyzeRecruiterMessage(new AnalyzeMessageRequest());

        Assert.Equal(500, Assert.IsType<ObjectResult>(result).StatusCode);
    }
}
