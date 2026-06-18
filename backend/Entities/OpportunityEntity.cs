namespace RecruiterReply.Entities;

public class OpportunityEntity
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string CompanyName { get; set; } = string.Empty;
    public string PositionTitle { get; set; } = string.Empty;
    public string? RecruiterName { get; set; }
    public string? RecruiterEmail { get; set; }
    public string? JobDescription { get; set; }
    public string Status { get; set; } = "lead";
    public int? SalaryMin { get; set; }
    public int? SalaryMax { get; set; }
    public string? JobType { get; set; }
    public string? Location { get; set; }
    public string? RemoteFlexibility { get; set; }
    public DateOnly? StartDate { get; set; }
    public string? Source { get; set; }
    public DateTime? LastContactDate { get; set; }
    public DateTime? NextFollowupDate { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
