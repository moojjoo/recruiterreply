namespace RecruiterReply.Services;

/// <summary>
/// Cheap keyword heuristics run before the LLM so we don't pay to classify every email in the inbox.
/// Tuned for recall: false positives are fine (the LLM drops them), false negatives lose leads.
/// </summary>
public static class RecruiterPrefilter
{
    private static readonly string[] Keywords =
    [
        "recruit", "opportunity", "position", "role", "job", "hiring", "contract", "c2c", "corp to corp",
        "w2", "w-2", "1099", "full-time", "full time", "resume", "candidate", "requirement", "talent",
        "staffing", "rate", "salary", "compensation", "interview", "remote", "hybrid", "onsite", "on-site",
    ];

    private const int MinKeywordHits = 2;

    public static bool LooksLikeRecruiterEmail(GmailMessageDetail message, string userEmail)
    {
        if (message.IsSentByUser || IsFrom(message.From, userEmail))
        {
            return false;
        }

        var text = $"{message.Subject} {Truncate(message.Body, 3000)}";
        var hits = Keywords.Count(k => text.Contains(k, StringComparison.OrdinalIgnoreCase));
        return hits >= MinKeywordHits;
    }

    private static bool IsFrom(string? from, string email) =>
        !string.IsNullOrWhiteSpace(from) && !string.IsNullOrWhiteSpace(email)
        && from.Contains(email, StringComparison.OrdinalIgnoreCase);

    private static string Truncate(string? value, int max) =>
        string.IsNullOrEmpty(value) ? string.Empty : value.Length <= max ? value : value[..max];
}
