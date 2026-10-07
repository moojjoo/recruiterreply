namespace RecruiterReply.Entities;

/// <summary>
/// What a user is looking for in their next career move. Drives the deterministic
/// <see cref="Services.CareerRulesEngine"/> that triages inbound recruiter email.
/// </summary>
public class CareerProfileEntity
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public List<string> TargetTitles { get; set; } = [];
    public List<string> Skills { get; set; } = [];
    public decimal? MinW2HourlyRate { get; set; }
    public decimal? MinC2CHourlyRate { get; set; }
    public decimal? MinSalary { get; set; }
    /// <summary>Accepted employment types: w2, c2c, 1099, fte. Empty = any.</summary>
    public List<string> EmploymentTypes { get; set; } = [];
    /// <summary>Accepted work modes: remote, hybrid, onsite. Empty = any.</summary>
    public List<string> WorkModes { get; set; } = [];
    /// <summary>Locations acceptable for hybrid/onsite roles. Empty = anywhere.</summary>
    public List<string> AllowedLocations { get; set; } = [];
    public int? MinContractMonths { get; set; }
    public List<string> DealBreakerKeywords { get; set; } = [];
    public List<string> BlockedCompanies { get; set; } = [];
    /// <summary>Facts that must be known before an opportunity is surfaced (see <see cref="Services.RecruiterFactFields"/>).</summary>
    public List<string> MustKnowFields { get; set; } = [];
    public string? Tone { get; set; }
    public string? Signature { get; set; }
    public bool DiscloseMinRate { get; set; }
    public bool AutoSendRequestInfo { get; set; }
    public bool AutoSendDecline { get; set; }
    public int DailySendCap { get; set; } = 10;
    public bool Paused { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
