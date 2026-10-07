using System.Text.Json.Serialization;

namespace RecruiterReply.Services;

/// <summary>Structured facts the LLM extracts from a recruiter email. Null = not stated.</summary>
public class RecruiterFacts
{
    [JsonPropertyName("isRecruiter")] public bool IsRecruiter { get; set; }
    [JsonPropertyName("title")] public string? Title { get; set; }
    [JsonPropertyName("company")] public string? Company { get; set; }
    [JsonPropertyName("endClient")] public string? EndClient { get; set; }
    /// <summary>w2 | c2c | 1099 | fte</summary>
    [JsonPropertyName("employmentType")] public string? EmploymentType { get; set; }
    [JsonPropertyName("rateMin")] public decimal? RateMin { get; set; }
    [JsonPropertyName("rateMax")] public decimal? RateMax { get; set; }
    /// <summary>hour | year</summary>
    [JsonPropertyName("rateUnit")] public string? RateUnit { get; set; }
    [JsonPropertyName("location")] public string? Location { get; set; }
    /// <summary>remote | hybrid | onsite</summary>
    [JsonPropertyName("workMode")] public string? WorkMode { get; set; }
    [JsonPropertyName("durationMonths")] public int? DurationMonths { get; set; }
    [JsonPropertyName("recruiterName")] public string? RecruiterName { get; set; }
    [JsonPropertyName("agency")] public string? Agency { get; set; }
    [JsonPropertyName("skills")] public List<string> Skills { get; set; } = [];

    /// <summary>Overlays any facts stated in <paramref name="newer"/> onto this instance (later thread messages win).</summary>
    public RecruiterFacts MergeWith(RecruiterFacts newer) => new()
    {
        IsRecruiter = IsRecruiter || newer.IsRecruiter,
        Title = newer.Title ?? Title,
        Company = newer.Company ?? Company,
        EndClient = newer.EndClient ?? EndClient,
        EmploymentType = newer.EmploymentType ?? EmploymentType,
        RateMin = newer.RateMin ?? RateMin,
        RateMax = newer.RateMax ?? RateMax,
        RateUnit = newer.RateUnit ?? RateUnit,
        Location = newer.Location ?? Location,
        WorkMode = newer.WorkMode ?? WorkMode,
        DurationMonths = newer.DurationMonths ?? DurationMonths,
        RecruiterName = newer.RecruiterName ?? RecruiterName,
        Agency = newer.Agency ?? Agency,
        Skills = Skills.Union(newer.Skills, StringComparer.OrdinalIgnoreCase).ToList(),
    };
}

public static class RecruiterFactFields
{
    public const string Rate = "rate";
    public const string EmploymentType = "employment_type";
    public const string WorkMode = "work_mode";
    public const string Location = "location";
    public const string EndClient = "end_client";
    public const string Duration = "duration";

    public static readonly string[] Defaults = [Rate, EmploymentType, WorkMode];
    public static readonly string[] All = [Rate, EmploymentType, WorkMode, Location, EndClient, Duration];
}
