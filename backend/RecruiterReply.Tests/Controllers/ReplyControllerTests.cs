using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using RecruiterReply.Controllers;
using RecruiterReply.Models;
using RecruiterReply.Services;
using RecruiterReply.Tests.Testing;

namespace RecruiterReply.Tests.Controllers;

public class ReplyControllerTests
{
    private readonly Mock<IReplyService> _service = new();
    private readonly ReplyController _sut;
    private readonly Guid _userId = Guid.NewGuid();

    public ReplyControllerTests()
    {
        _sut = new ReplyController(_service.Object, NullLogger<ReplyController>.Instance);
        _sut.SetUser(_userId);
    }

    [Fact]
    public async Task GenerateReply_OnSuccess_Returns200WithResult()
    {
        var response = new GenerateReplyResponse { Reply = "Thanks!" };
        _service.Setup(s => s.GenerateReplyAsync(It.IsAny<GenerateReplyRequest>(), _userId)).ReturnsAsync(response);

        var result = await _sut.GenerateReply(new GenerateReplyRequest { ReplyType = "interested", RecruiterMessage = "hi" });

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Same(response, ok.Value);
    }

    [Fact]
    public async Task GenerateReply_OnArgumentException_Returns400()
    {
        _service.Setup(s => s.GenerateReplyAsync(It.IsAny<GenerateReplyRequest>(), _userId)).ThrowsAsync(new ArgumentException("bad"));

        var result = await _sut.GenerateReply(new GenerateReplyRequest());

        Assert.Equal(400, Assert.IsType<BadRequestObjectResult>(result).StatusCode);
    }

    [Fact]
    public async Task GenerateReply_OnQuotaExceeded_Returns402()
    {
        _service.Setup(s => s.GenerateReplyAsync(It.IsAny<GenerateReplyRequest>(), _userId))
            .ThrowsAsync(new QuotaExceededException("limit reached"));

        var result = await _sut.GenerateReply(new GenerateReplyRequest());

        Assert.Equal(402, Assert.IsType<ObjectResult>(result).StatusCode);
    }

    [Fact]
    public async Task GenerateReply_OnInvalidOperationException_Returns502()
    {
        _service.Setup(s => s.GenerateReplyAsync(It.IsAny<GenerateReplyRequest>(), _userId))
            .ThrowsAsync(new InvalidOperationException("down"));

        var result = await _sut.GenerateReply(new GenerateReplyRequest());

        Assert.Equal(502, Assert.IsType<ObjectResult>(result).StatusCode);
    }

    [Fact]
    public async Task GenerateReply_OnUnhandledException_Returns500()
    {
        _service.Setup(s => s.GenerateReplyAsync(It.IsAny<GenerateReplyRequest>(), _userId)).ThrowsAsync(new Exception("boom"));

        var result = await _sut.GenerateReply(new GenerateReplyRequest());

        Assert.Equal(500, Assert.IsType<ObjectResult>(result).StatusCode);
    }
}
