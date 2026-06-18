namespace RecruiterReply.Models;

public class AnalyzeMessageRequest
{
    public string RecruiterMessage { get; set; } = string.Empty;
    public string? CompanyName { get; set; }
    public string? JobTitle { get; set; }
}
