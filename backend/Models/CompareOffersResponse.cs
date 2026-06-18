namespace RecruiterReply.Models;

public class CompareOffersResponse
{
    public decimal EstimatedAnnualValueOne { get; set; }
    public decimal EstimatedAnnualValueTwo { get; set; }
    public List<string> ProsOne { get; set; } = new();
    public List<string> ProsTwo { get; set; } = new();
    public List<string> ConsOne { get; set; } = new();
    public List<string> ConsTwo { get; set; } = new();
    public string RiskLevelOne { get; set; } = string.Empty;
    public string RiskLevelTwo { get; set; } = string.Empty;
    public string Recommendation { get; set; } = string.Empty;
    public string BestOffer { get; set; } = string.Empty;
}
