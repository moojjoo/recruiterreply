using RecruiterReply.Models;
using RecruiterReply.Services;
using RecruiterReply.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace RecruiterReply.Controllers;

[ApiController]
[Route("api")]
[Authorize]
public class AnalysisController : ControllerBase
{
    private readonly IAnalysisService _analysisService;
    private readonly ILogger<AnalysisController> _logger;

    public AnalysisController(IAnalysisService analysisService, ILogger<AnalysisController> logger)
    {
        _analysisService = analysisService;
        _logger = logger;
    }

    [HttpPost("analyze-recruiter-message")]
    public async Task<IActionResult> AnalyzeRecruiterMessage([FromBody] AnalyzeMessageRequest request)
    {
        try
        {
            var userId = User.GetRequiredUserId();
            var result = await _analysisService.AnalyzeRecruiterMessageAsync(request, userId);
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "OpenAI operation failed in AnalyzeRecruiterMessage");
            return StatusCode(502, new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in AnalyzeRecruiterMessage");
            return StatusCode(500, new { error = "An error occurred while analyzing the message" });
        }
    }
}
