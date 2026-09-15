namespace RecruiterReply.Entities;

public class UsageRecordEntity
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string Feature { get; set; } = string.Empty;
    public DateTime PeriodStart { get; set; }
    public int Count { get; set; }
}
