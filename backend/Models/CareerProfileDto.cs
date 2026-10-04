namespace RecruiterReply.Models;

public class CareerProfileDto
{
    public List<string> TargetTitles { get; set; } = [];
    public List<string> Skills { get; set; } = [];
    public decimal? MinW2HourlyRate { get; set; }
    public decimal? MinC2CHourlyRate { get; set; }
    public decimal? MinSalary { get; set; }
    public List<string> EmploymentTypes { get; set; } = [];
    public List<string> WorkModes { get; set; } = [];
    public List<string> AllowedLocations { get; set; } = [];
    public int? MinContractMonths { get; set; }
    public List<string> DealBreakerKeywords { get; set; } = [];
    public List<string> BlockedCompanies { get; set; } = [];
    public List<string> MustKnowFields { get; set; } = [];
    public string? Tone { get; set; }
    public string? Signature { get; set; }
    public bool DiscloseMinRate { get; set; }
    public bool AutoSendRequestInfo { get; set; }
    public bool AutoSendDecline { get; set; }
    public int DailySendCap { get; set; } = 10;
    public bool Paused { get; set; }
}

public class RecruiterThreadDto
{
    public Guid Id { get; set; }
    public string GmailThreadId { get; set; } = string.Empty;
    public string? Subject { get; set; }
    public string? RecruiterEmail { get; set; }
    public string State { get; set; } = string.Empty;
    public Services.RecruiterFacts? Facts { get; set; }
    public List<string> MissingFields { get; set; } = [];
    public List<string> Reasons { get; set; } = [];
    public DateTime LastMessageAt { get; set; }
}
