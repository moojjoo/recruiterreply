using RecruiterReply.Entities;

namespace RecruiterReply.Services;

public record TriageReplyContext(
    string State,
    IReadOnlyList<string> MissingFields,
    IReadOnlyList<string> Reasons,
    CareerProfileEntity? Profile,
    string? RecruiterName,
    string Subject,
    string Body);
