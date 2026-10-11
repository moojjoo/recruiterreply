namespace RecruiterReply.Services;

public interface IRecoveryEmailSender
{
    Task SendAsync(string email, string code, string link, CancellationToken ct);
}
