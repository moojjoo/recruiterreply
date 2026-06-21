namespace RecruiterReply.Entities;

public class MessageAnalysisEntity
{
    public Guid Id { get; set; }
    public Guid MessageId { get; set; }
    public Guid UserId { get; set; }
    public int? CompetitivenessScore { get; set; }
    public string? CompensationEvaluation { get; set; }
    public string? RedFlags { get; set; }
    public string? AnalysisSummary { get; set; }
    public string? SuggestedTone { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
