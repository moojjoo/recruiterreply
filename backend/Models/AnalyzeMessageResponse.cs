namespace RecruiterReply.Models;

public class AnalyzeMessageResponse
{
    public string CompensationMentioned { get; set; } = string.Empty;
    public string JobType { get; set; } = string.Empty;
    public List<string> RedFlags { get; set; } = new();
    public List<string> QuestionsToAsk { get; set; } = new();
    public string SuggestedResponse { get; set; } = string.Empty;
    public int OpportunityScore { get; set; }
}
