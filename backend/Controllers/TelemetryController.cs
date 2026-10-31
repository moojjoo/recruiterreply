using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using RecruiterReply.Observability;

namespace RecruiterReply.Controllers;

[ApiController]
[Route("api/telemetry")]
[AllowAnonymous]
[EnableRateLimiting("frontend-telemetry")]
public sealed class TelemetryController(FrontendTelemetryQueue queue) : ControllerBase
{
    [HttpPost]
    [RequestSizeLimit(16 * 1024)]
    public IActionResult Ingest([FromBody] FrontendTelemetryEvent input)
    {
        if (!FrontendTelemetryValidation.TryNormalize(input, out var normalized) || !queue.TryEnqueue(normalized))
        {
            return BadRequest(new { error = "Invalid telemetry event." });
        }

        return Accepted();
    }
}
