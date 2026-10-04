namespace RecruiterReply.Entities;

/// <summary>
/// Claim record for each Gmail message the pipeline has seen. The unique (UserId, GmailMessageId)
/// index makes processing idempotent across poll cycles.
/// </summary>
public class RecruiterEmailEntity
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid? ThreadId { get; set; }
    public string GmailMessageId { get; set; } = string.Empty;
    public string GmailThreadId { get; set; } = string.Empty;
    /// <summary>inbound | outbound</summary>
    public string Direction { get; set; } = "inbound";
    public string? From { get; set; }
    public string? Subject { get; set; }
    /// <summary>processed | skipped | quota_exceeded | error</summary>
    public string Status { get; set; } = "processed";
    public string? Error { get; set; }
    public DateTime ReceivedAt { get; set; }
    public DateTime CreatedAt { get; set; }
}
