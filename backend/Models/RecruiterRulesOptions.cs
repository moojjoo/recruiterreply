namespace RecruiterReply.Models;

public class RecruiterRulesOptions
{
    public decimal C2CMinHourlyRate { get; set; }
    public decimal W2MinHourlyRate { get; set; }
    public string[] PreferredLocations { get; set; } = [];
    public int MinPreferredContractMonths { get; set; }
    public bool RejectUnpaidTravel { get; set; }
    public bool RejectUnpaidLodging { get; set; }
    public bool RejectUnpaidMeals { get; set; }
    public string[] PriorityKeywords { get; set; } = [];
}
