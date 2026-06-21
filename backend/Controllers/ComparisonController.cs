using RecruiterReply.Models;
using RecruiterReply.Services;
using RecruiterReply.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace RecruiterReply.Controllers;

[ApiController]
[Route("api")]
[Authorize]
public class ComparisonController : ControllerBase
{
    private readonly IComparisonService _comparisonService;
    private readonly ILogger<ComparisonController> _logger;

    public ComparisonController(IComparisonService comparisonService, ILogger<ComparisonController> logger)
    {
        _comparisonService = comparisonService;
        _logger = logger;
    }

    [HttpPost("compare-offers")]
    public async Task<IActionResult> CompareOffers([FromBody] CompareOffersRequest request)
    {
        try
        {
            var userId = User.GetRequiredUserId();
            var result = await _comparisonService.CompareOffersAsync(request, userId);
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in CompareOffers");
            return StatusCode(500, new { error = "An error occurred while comparing offers" });
        }
    }
}
