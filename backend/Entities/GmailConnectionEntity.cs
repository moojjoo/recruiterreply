namespace RecruiterReply.Entities;

public class GmailConnectionEntity
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string GoogleAccountEmail { get; set; } = string.Empty;
    public string AccessTokenEncrypted { get; set; } = string.Empty;
    public string RefreshTokenEncrypted { get; set; } = string.Empty;
    public DateTime TokenExpiresAt { get; set; }
    public string GrantedScopes { get; set; } = string.Empty;
    public string? HistoryId { get; set; }
    public DateTime? LastSyncedAt { get; set; }
    public string? LastSyncStatus { get; set; }
    public string? LastSyncError { get; set; }
    public string Status { get; set; } = "active";
    public string? LabelIds { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
