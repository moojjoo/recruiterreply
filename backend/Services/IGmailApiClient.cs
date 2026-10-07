namespace RecruiterReply.Services;

public record GmailMessageSummary(string MessageId, string ThreadId, string? Subject, string? From);

public record GmailMessageDetail(
    string MessageId,
    string ThreadId,
    string? Subject,
    string? From,
    string? ReplyTo,
    string? RfcMessageId,
    string? References,
    DateTime ReceivedAt,
    bool IsSentByUser,
    string Body);

public class GmailHistoryResult
{
    /// <summary>True when Gmail no longer has history for the requested startHistoryId (its retention window
    /// passed) — the caller should fall back to a bounded recent-message listing instead.</summary>
    public bool HistoryExpired { get; init; }
    public IReadOnlyList<string> MessageIds { get; init; } = [];
}

public record GmailDraftReply(string ThreadId, string To, string Subject, string? InReplyTo, string? References, string Body);

/// <summary>
/// Thin wrapper around the Gmail API. Reads mail, manages labels and creates drafts.
/// Never sends: the user sends drafts themselves until opt-in auto-send ships.
/// </summary>
public interface IGmailApiClient
{
    Task<string> GetProfileHistoryIdAsync(string accessToken, CancellationToken cancellationToken = default);

    /// <summary>Bounded baseline listing used on first sync or when history has expired.</summary>
    Task<IReadOnlyList<string>> ListRecentInboxMessageIdsAsync(string accessToken, CancellationToken cancellationToken = default);

    Task<GmailHistoryResult> ListMessageIdsSinceHistoryAsync(string accessToken, string startHistoryId, CancellationToken cancellationToken = default);

    Task<GmailMessageSummary> GetMessageSummaryAsync(string accessToken, string messageId, CancellationToken cancellationToken = default);

    /// <summary>Full message with decoded body (text/plain preferred, tag-stripped text/html fallback).</summary>
    Task<GmailMessageDetail> GetMessageFullAsync(string accessToken, string messageId, CancellationToken cancellationToken = default);

    /// <summary>Returns the id of the user label with this name, creating it if needed.</summary>
    Task<string> EnsureLabelAsync(string accessToken, string name, CancellationToken cancellationToken = default);

    Task ModifyThreadLabelsAsync(string accessToken, string threadId, IReadOnlyList<string> addLabelIds, IReadOnlyList<string> removeLabelIds, CancellationToken cancellationToken = default);

    /// <summary>Creates a draft reply in the thread and returns the draft id.</summary>
    Task<string> CreateDraftReplyAsync(string accessToken, GmailDraftReply reply, CancellationToken cancellationToken = default);

    /// <summary>Deletes a draft; a draft the user already sent or deleted is ignored.</summary>
    Task DeleteDraftAsync(string accessToken, string draftId, CancellationToken cancellationToken = default);
}
