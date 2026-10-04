using RecruiterReply.Entities;

namespace RecruiterReply.Services;

public static class TriageStates
{
    public const string Qualified = "qualified";
    public const string NeedsInfo = "needs_info";
    public const string BelowBar = "below_bar";
    public const string Ignored = "ignored";
}

public record TriageDecision(string State, IReadOnlyList<string> MissingFields, IReadOnlyList<string> Reasons);

/// <summary>
/// Deterministic evaluation of extracted recruiter facts against a user's career profile.
/// Deliberately not LLM-driven so decisions are predictable, explainable and testable.
/// Below-bar wins over needs-info: there's no point asking for details on a role already ruled out.
/// </summary>
public static class CareerRulesEngine
{
    private const decimal HoursPerYear = 2080m;

    public static TriageDecision Evaluate(RecruiterFacts facts, CareerProfileEntity? profile, string emailText = "")
    {
        if (!facts.IsRecruiter)
        {
            return new TriageDecision(TriageStates.Ignored, [], []);
        }

        profile ??= new CareerProfileEntity();
        var reasons = new List<string>();
        var employmentType = Normalize(facts.EmploymentType);
        var workMode = Normalize(facts.WorkMode);

        var haystack = $"{facts.Title} {facts.Company} {facts.EndClient} {emailText}";
        foreach (var keyword in profile.DealBreakerKeywords.Where(k => !string.IsNullOrWhiteSpace(k)))
        {
            if (haystack.Contains(keyword, StringComparison.OrdinalIgnoreCase))
            {
                reasons.Add($"Contains deal-breaker \"{keyword}\"");
            }
        }

        foreach (var company in profile.BlockedCompanies.Where(c => !string.IsNullOrWhiteSpace(c)))
        {
            if (Matches(facts.Company, company) || Matches(facts.EndClient, company) || Matches(facts.Agency, company))
            {
                reasons.Add($"Blocked company \"{company}\"");
            }
        }

        if (employmentType is not null && profile.EmploymentTypes.Count > 0
            && !profile.EmploymentTypes.Any(t => Normalize(t) == employmentType))
        {
            reasons.Add($"Employment type {employmentType.ToUpperInvariant()} not accepted");
        }

        if (workMode is not null && profile.WorkModes.Count > 0
            && !profile.WorkModes.Any(m => Normalize(m) == workMode))
        {
            reasons.Add($"Work mode {workMode} not accepted");
        }
        else if (workMode is "hybrid" or "onsite" && profile.AllowedLocations.Count > 0
            && !string.IsNullOrWhiteSpace(facts.Location)
            && !profile.AllowedLocations.Any(l => Matches(facts.Location, l)))
        {
            reasons.Add($"Location {facts.Location} not in allowed locations");
        }

        var rateReason = EvaluateRate(facts, profile, employmentType);
        if (rateReason is not null)
        {
            reasons.Add(rateReason);
        }

        var isContract = employmentType is "w2" or "c2c" or "1099" || facts.DurationMonths is not null;
        if (isContract && facts.DurationMonths is { } months && profile.MinContractMonths is { } minMonths && months < minMonths)
        {
            reasons.Add($"Contract length {months} months is under {minMonths}");
        }

        if (reasons.Count > 0)
        {
            return new TriageDecision(TriageStates.BelowBar, [], reasons);
        }

        var mustKnow = profile.MustKnowFields.Count > 0 ? profile.MustKnowFields : RecruiterFactFields.Defaults.ToList();
        var missing = mustKnow
            .Select(f => f.Trim().ToLowerInvariant())
            .Distinct()
            .Where(field => IsMissing(field, facts, employmentType, workMode))
            .ToList();

        return missing.Count > 0
            ? new TriageDecision(TriageStates.NeedsInfo, missing, [])
            : new TriageDecision(TriageStates.Qualified, [], []);
    }

    private static string? EvaluateRate(RecruiterFacts facts, CareerProfileEntity profile, string? employmentType)
    {
        // Compare the top of the offered range: if even that is under the floor, it's below the bar.
        var offered = facts.RateMax ?? facts.RateMin;
        if (offered is null)
        {
            return null;
        }

        var unit = Normalize(facts.RateUnit) ?? (offered > 1000 ? "year" : "hour");

        if (unit == "year")
        {
            return profile.MinSalary is { } minSalary && offered < minSalary
                ? $"Salary {offered:N0} is under minimum {minSalary:N0}"
                : null;
        }

        decimal? floor = employmentType switch
        {
            "c2c" => profile.MinC2CHourlyRate,
            "w2" or "1099" => profile.MinW2HourlyRate,
            "fte" => profile.MinSalary / HoursPerYear,
            // Unknown type: the lower floor is the most generous check that can still rule a role out.
            _ => Min(profile.MinW2HourlyRate, profile.MinC2CHourlyRate),
        };

        return floor is { } f && offered < f
            ? $"Rate ${offered:0.##}/hr is under minimum ${f:0.##}/hr"
            : null;
    }

    private static bool IsMissing(string field, RecruiterFacts facts, string? employmentType, string? workMode) => field switch
    {
        RecruiterFactFields.Rate => facts.RateMin is null && facts.RateMax is null,
        RecruiterFactFields.EmploymentType => employmentType is null,
        RecruiterFactFields.WorkMode => workMode is null,
        RecruiterFactFields.Location => workMode != "remote" && string.IsNullOrWhiteSpace(facts.Location),
        RecruiterFactFields.EndClient => string.IsNullOrWhiteSpace(facts.EndClient),
        RecruiterFactFields.Duration => employmentType != "fte" && facts.DurationMonths is null,
        _ => false,
    };

    private static string? Normalize(string? value)
    {
        var v = value?.Trim().ToLowerInvariant();
        return string.IsNullOrEmpty(v) || v == "unknown" ? null : v;
    }

    private static bool Matches(string? value, string pattern) =>
        !string.IsNullOrWhiteSpace(value) && value.Contains(pattern.Trim(), StringComparison.OrdinalIgnoreCase);

    private static decimal? Min(decimal? a, decimal? b) => a is null ? b : b is null ? a : Math.Min(a.Value, b.Value);
}
