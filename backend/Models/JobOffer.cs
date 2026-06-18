namespace RecruiterReply.Models;

public class JobOffer
{
    public string Company { get; set; } = string.Empty;
    public string JobTitle { get; set; } = string.Empty;
    public decimal Salary { get; set; }
    public decimal? HourlyRate { get; set; }
    public string CompensationType { get; set; } = "W2"; // W2 or C2C
    public int ContractLengthMonths { get; set; } = 12;
    public decimal BenefitsEstimate { get; set; } = 0;
    public int CommuteTimeMinutes { get; set; } = 0;
    public string WorkArrangement { get; set; } = "onsite"; // remote, hybrid, onsite
    public string? Notes { get; set; }
}
