namespace RecruiterReply.Entities;

public class GeneratedReplyEntity
{
    public Guid Id { get; set; }
    public Guid AnalysisId { get; set; }
    public Guid UserId { get; set; }
    public string ReplyType { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string? Tone { get; set; }
    public bool IsUsed { get; set; }
    public DateTime CreatedAt { get; set; }
}
