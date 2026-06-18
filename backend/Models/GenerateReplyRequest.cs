namespace RecruiterReply.Models;

public class GenerateReplyRequest
{
    public string ReplyType { get; set; } = string.Empty; // interested, request_pay_range, counteroffer, decline, followup
    public string RecruiterMessage { get; set; } = string.Empty;
    public decimal? CandidateMinimumPay { get; set; }
    public string? PreferredWorkArrangement { get; set; } // remote, hybrid, onsite
    public string? Notes { get; set; }
}
