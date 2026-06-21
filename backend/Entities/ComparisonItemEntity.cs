namespace RecruiterReply.Entities;

public class ComparisonItemEntity
{
    public Guid Id { get; set; }
    public Guid ComparisonId { get; set; }
    public string CompanyName { get; set; } = string.Empty;
    public string PositionTitle { get; set; } = string.Empty;
    public decimal? Salary { get; set; }
    public decimal? HourlyRate { get; set; }
    public decimal? SigningBonus { get; set; }
    public decimal? AnnualBonus { get; set; }
    public string? StockOptions { get; set; }
    public bool? HealthInsurance { get; set; }
    public bool? DentalInsurance { get; set; }
    public bool? VisionInsurance { get; set; }
    public bool? Retirement401k { get; set; }
    public int? PtoDays { get; set; }
    public int? CommuteMinutes { get; set; }
    public string? RemoteFlexibility { get; set; }
    public int? ContractLengthMonths { get; set; }
    public DateOnly? StartDate { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
