namespace RecruiterReply.Models;

public class GmailStatusResponse
{
    public bool IsConnected { get; set; }
    public string? GoogleAccountEmail { get; set; }
    public string? Status { get; set; }
    public DateTime? LastSyncedAt { get; set; }
    public string? LastSyncStatus { get; set; }
    public string? LastSyncError { get; set; }
}
