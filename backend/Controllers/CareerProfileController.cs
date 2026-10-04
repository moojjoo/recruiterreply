using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RecruiterReply.Entities;
using RecruiterReply.Extensions;
using RecruiterReply.Models;
using RecruiterReply.Repositories;
using RecruiterReply.Services;

namespace RecruiterReply.Controllers;

[ApiController]
[Route("api/career-profile")]
[Authorize]
public class CareerProfileController : ControllerBase
{
    private static readonly HashSet<string> EmploymentTypes = ["w2", "c2c", "1099", "fte"];
    private static readonly HashSet<string> WorkModes = ["remote", "hybrid", "onsite"];

    private readonly IRecruiterInboxRepository _repository;

    public CareerProfileController(IRecruiterInboxRepository repository)
    {
        _repository = repository;
    }

    [HttpGet]
    public async Task<ActionResult<CareerProfileDto>> Get(CancellationToken ct)
    {
        var profile = await _repository.GetProfileAsync(User.GetRequiredUserId(), ct);
        return Ok(profile is null ? new CareerProfileDto { MustKnowFields = [.. RecruiterFactFields.Defaults] } : ToDto(profile));
    }

    [HttpPut]
    public async Task<ActionResult<CareerProfileDto>> Put([FromBody] CareerProfileDto request, CancellationToken ct)
    {
        var error = Validate(request);
        if (error is not null)
        {
            return BadRequest(new { error });
        }

        var userId = User.GetRequiredUserId();
        var now = DateTime.UtcNow;
        var profile = await _repository.GetProfileAsync(userId, ct)
            ?? new CareerProfileEntity { Id = Guid.NewGuid(), UserId = userId, CreatedAt = now };

        profile.TargetTitles = Clean(request.TargetTitles);
        profile.Skills = Clean(request.Skills);
        profile.MinW2HourlyRate = request.MinW2HourlyRate;
        profile.MinC2CHourlyRate = request.MinC2CHourlyRate;
        profile.MinSalary = request.MinSalary;
        profile.EmploymentTypes = Clean(request.EmploymentTypes, lower: true);
        profile.WorkModes = Clean(request.WorkModes, lower: true);
        profile.AllowedLocations = Clean(request.AllowedLocations);
        profile.MinContractMonths = request.MinContractMonths;
        profile.DealBreakerKeywords = Clean(request.DealBreakerKeywords);
        profile.BlockedCompanies = Clean(request.BlockedCompanies);
        profile.MustKnowFields = Clean(request.MustKnowFields, lower: true);
        profile.Tone = request.Tone?.Trim();
        profile.Signature = request.Signature?.Trim();
        profile.DiscloseMinRate = request.DiscloseMinRate;
        profile.AutoSendRequestInfo = request.AutoSendRequestInfo;
        profile.AutoSendDecline = request.AutoSendDecline;
        profile.DailySendCap = request.DailySendCap;
        profile.Paused = request.Paused;
        profile.UpdatedAt = now;

        await _repository.SaveProfileAsync(profile, ct);
        return Ok(ToDto(profile));
    }

    private static string? Validate(CareerProfileDto request)
    {
        if (request.EmploymentTypes.Any(t => !EmploymentTypes.Contains(t.Trim().ToLowerInvariant())))
            return "employmentTypes must be any of: w2, c2c, 1099, fte";
        if (request.WorkModes.Any(m => !WorkModes.Contains(m.Trim().ToLowerInvariant())))
            return "workModes must be any of: remote, hybrid, onsite";
        if (request.MustKnowFields.Any(f => !RecruiterFactFields.All.Contains(f.Trim().ToLowerInvariant())))
            return $"mustKnowFields must be any of: {string.Join(", ", RecruiterFactFields.All)}";
        if (request.MinW2HourlyRate < 0 || request.MinC2CHourlyRate < 0 || request.MinSalary < 0 || request.MinContractMonths < 0)
            return "Minimums cannot be negative";
        if (request.DailySendCap is < 0 or > 100)
            return "dailySendCap must be between 0 and 100";
        if (request.Signature?.Length > 1000)
            return "signature must be 1000 characters or fewer";
        return null;
    }

    private static List<string> Clean(List<string> values, bool lower = false) =>
        values.Select(v => lower ? v.Trim().ToLowerInvariant() : v.Trim())
            .Where(v => v.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(50)
            .ToList();

    private static CareerProfileDto ToDto(CareerProfileEntity p) => new()
    {
        TargetTitles = p.TargetTitles,
        Skills = p.Skills,
        MinW2HourlyRate = p.MinW2HourlyRate,
        MinC2CHourlyRate = p.MinC2CHourlyRate,
        MinSalary = p.MinSalary,
        EmploymentTypes = p.EmploymentTypes,
        WorkModes = p.WorkModes,
        AllowedLocations = p.AllowedLocations,
        MinContractMonths = p.MinContractMonths,
        DealBreakerKeywords = p.DealBreakerKeywords,
        BlockedCompanies = p.BlockedCompanies,
        MustKnowFields = p.MustKnowFields,
        Tone = p.Tone,
        Signature = p.Signature,
        DiscloseMinRate = p.DiscloseMinRate,
        AutoSendRequestInfo = p.AutoSendRequestInfo,
        AutoSendDecline = p.AutoSendDecline,
        DailySendCap = p.DailySendCap,
        Paused = p.Paused,
    };
}
