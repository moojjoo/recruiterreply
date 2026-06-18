using RecruiterReply.Models;
using RecruiterReply.Services;
using Microsoft.AspNetCore.Mvc;

namespace RecruiterReply.Controllers;

[ApiController]
[Route("api")]
public class ReplyController : ControllerBase
{
    private readonly IReplyService _replyService;
    private readonly ILogger<ReplyController> _logger;

    public ReplyController(IReplyService replyService, ILogger<ReplyController> logger)
    {
        _replyService = replyService;
        _logger = logger;
    }

    [HttpPost("generate-reply")]
    public async Task<IActionResult> GenerateReply([FromBody] GenerateReplyRequest request)
    {
        try
        {
            var result = await _replyService.GenerateReplyAsync(request);
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in GenerateReply");
            return StatusCode(500, new { error = "An error occurred while generating the reply" });
        }
    }
}
