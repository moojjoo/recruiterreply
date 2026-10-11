namespace RecruiterReply.Entities;

public sealed class ConsentAuditEventEntity
{
    public Guid EventId { get; set; }
    public Guid ConsentId { get; set; }
    public string Action { get; set; } = "";
    public bool AnalyticsEnabled { get; set; }
    public int PolicyVersion { get; set; }
    public DateTime CreatedAt { get; set; }
}
