using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RecruiterReply.Data;
using RecruiterReply.Entities;
using RecruiterReply.Services;

namespace RecruiterReply.Controllers;

[ApiController]
[Route("api/opportunities")]
public class OpportunitiesController : ControllerBase
{
    private readonly RecruiterReplyDbContext _db;
    private readonly IDefaultUserService _defaultUserService;

    public OpportunitiesController(RecruiterReplyDbContext db, IDefaultUserService defaultUserService)
    {
        _db = db;
        _defaultUserService = defaultUserService;
    }

    [HttpGet]
    public async Task<IActionResult> GetOpportunities(CancellationToken ct)
    {
        var userId = await _defaultUserService.GetOrCreateDefaultUserIdAsync(ct);
        var opportunities = await _db.Opportunities
            .AsNoTracking()
            .Where(o => o.UserId == userId)
            .OrderByDescending(o => o.CreatedAt)
            .ToListAsync(ct);

        return Ok(opportunities);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetOpportunity(Guid id, CancellationToken ct)
    {
        var userId = await _defaultUserService.GetOrCreateDefaultUserIdAsync(ct);
        var opportunity = await _db.Opportunities
            .AsNoTracking()
            .FirstOrDefaultAsync(o => o.Id == id && o.UserId == userId, ct);

        return opportunity is null ? NotFound() : Ok(opportunity);
    }

    [HttpPost]
    public async Task<IActionResult> CreateOpportunity([FromBody] OpportunityEntity request, CancellationToken ct)
    {
        var userId = await _defaultUserService.GetOrCreateDefaultUserIdAsync(ct);
        var now = DateTime.UtcNow;

        var opportunity = new OpportunityEntity
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            CompanyName = request.CompanyName,
            PositionTitle = request.PositionTitle,
            RecruiterName = request.RecruiterName,
            RecruiterEmail = request.RecruiterEmail,
            JobDescription = request.JobDescription,
            Status = string.IsNullOrWhiteSpace(request.Status) ? "lead" : request.Status,
            SalaryMin = request.SalaryMin,
            SalaryMax = request.SalaryMax,
            JobType = request.JobType,
            Location = request.Location,
            RemoteFlexibility = request.RemoteFlexibility,
            StartDate = request.StartDate,
            Source = request.Source,
            LastContactDate = request.LastContactDate,
            NextFollowupDate = request.NextFollowupDate,
            Notes = request.Notes,
            CreatedAt = now,
            UpdatedAt = now
        };

        _db.Opportunities.Add(opportunity);
        await _db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetOpportunity), new { id = opportunity.Id }, opportunity);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateOpportunity(Guid id, [FromBody] OpportunityEntity request, CancellationToken ct)
    {
        var userId = await _defaultUserService.GetOrCreateDefaultUserIdAsync(ct);
        var opportunity = await _db.Opportunities.FirstOrDefaultAsync(o => o.Id == id && o.UserId == userId, ct);

        if (opportunity is null)
        {
            return NotFound();
        }

        opportunity.CompanyName = request.CompanyName;
        opportunity.PositionTitle = request.PositionTitle;
        opportunity.RecruiterName = request.RecruiterName;
        opportunity.RecruiterEmail = request.RecruiterEmail;
        opportunity.JobDescription = request.JobDescription;
        opportunity.Status = string.IsNullOrWhiteSpace(request.Status) ? opportunity.Status : request.Status;
        opportunity.SalaryMin = request.SalaryMin;
        opportunity.SalaryMax = request.SalaryMax;
        opportunity.JobType = request.JobType;
        opportunity.Location = request.Location;
        opportunity.RemoteFlexibility = request.RemoteFlexibility;
        opportunity.StartDate = request.StartDate;
        opportunity.Source = request.Source;
        opportunity.LastContactDate = request.LastContactDate;
        opportunity.NextFollowupDate = request.NextFollowupDate;
        opportunity.Notes = request.Notes;
        opportunity.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return Ok(opportunity);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteOpportunity(Guid id, CancellationToken ct)
    {
        var userId = await _defaultUserService.GetOrCreateDefaultUserIdAsync(ct);
        var opportunity = await _db.Opportunities.FirstOrDefaultAsync(o => o.Id == id && o.UserId == userId, ct);

        if (opportunity is null)
        {
            return NotFound();
        }

        _db.Opportunities.Remove(opportunity);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}
