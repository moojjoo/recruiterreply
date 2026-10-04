namespace RecruiterReply.Entities;

/// <summary>One Gmail thread identified as recruiter outreach, with merged facts and the current triage decision.</summary>
public class RecruiterThreadEntity
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string GmailThreadId { get; set; } = string.Empty;
    public string? Subject { get; set; }
    public string? RecruiterEmail { get; set; }
    /// <summary>qualified | needs_info | below_bar | ignored</summary>
    public string State { get; set; } = "new";
    /// <summary>Merged <see cref="Services.RecruiterFacts"/> as jsonb.</summary>
    public string? Facts { get; set; }
    /// <summary>jsonb string array of missing must-know fields.</summary>
    public string? MissingFields { get; set; }
    /// <summary>jsonb string array of reasons the opportunity is below the user's bar.</summary>
    public string? Reasons { get; set; }
    public DateTime LastMessageAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
