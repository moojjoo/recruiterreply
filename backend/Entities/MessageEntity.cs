namespace RecruiterReply.Entities;

public class MessageEntity
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string? Subject { get; set; }
    public string Body { get; set; } = string.Empty;
    public string? SenderEmail { get; set; }
    public string? SenderName { get; set; }
    public string? CompanyName { get; set; }
    public DateTime? ReceivedDate { get; set; }
    public DateTime CreatedAt { get; set; }
}
