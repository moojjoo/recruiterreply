namespace RecruiterReply.Services;

public record GmailMessageSummary(string MessageId, string ThreadId, string? Subject, string? From);

public class GmailHistoryResult
{
    /// <summary>True when Gmail no longer has history for the requested startHistoryId (its retention window
    /// passed) — the caller should fall back to a bounded recent-message listing instead.</summary>
    public bool HistoryExpired { get; init; }
    public IReadOnlyList<string> MessageIds { get; init; } = [];
}

/// <summary>
/// Thin wrapper around the Gmail API. Read-only in Phase 1 — draft creation and label
/// application are added in a later phase. Never calls anything resembling send.
/// </summary>
public interface IGmailApiClient
{
    Task<string> GetProfileHistoryIdAsync(string accessToken, CancellationToken cancellationToken = default);

    /// <summary>Bounded baseline listing used on first sync or when history has expired.</summary>
    Task<IReadOnlyList<string>> ListRecentInboxMessageIdsAsync(string accessToken, CancellationToken cancellationToken = default);

    Task<GmailHistoryResult> ListMessageIdsSinceHistoryAsync(string accessToken, string startHistoryId, CancellationToken cancellationToken = default);

    Task<GmailMessageSummary> GetMessageSummaryAsync(string accessToken, string messageId, CancellationToken cancellationToken = default);
}
