using RecruiterReply.Entities;

namespace RecruiterReply.Services;

public interface IRecruiterActionService
{
    /// <summary>
    /// Writes the triage outcome back to Gmail: labels the thread and drafts a suggested reply.
    /// Mutates <paramref name="thread"/> (draft fields) and <paramref name="connection"/> (label cache);
    /// callers persist both.
    /// </summary>
    Task ApplyAsync(
        GmailConnectionEntity connection,
        string accessToken,
        RecruiterThreadEntity thread,
        GmailMessageDetail message,
        TriageDecision decision,
        RecruiterFacts facts,
        CareerProfileEntity? profile,
        CancellationToken cancellationToken = default);
}
