using Amazon.SimpleEmailV2;
using Amazon.SimpleEmailV2.Model;

namespace RecruiterReply.Services;

public sealed class SesRecoveryEmailSender(IConfiguration config) : IRecoveryEmailSender
{
    public async Task SendAsync(string email, string code, string link, CancellationToken ct)
    {
        if (!config.GetValue<bool>("PasswordRecovery:EmailEnabled"))
            throw new InvalidOperationException("Password recovery email is not enabled.");
        var from = config["PasswordRecovery:FromEmail"];
        if (string.IsNullOrWhiteSpace(from))
            throw new InvalidOperationException("PasswordRecovery:FromEmail is not configured.");
        using var ses = new AmazonSimpleEmailServiceV2Client();
        await ses.SendEmailAsync(new SendEmailRequest
        {
            FromEmailAddress = from,
            Destination = new Destination { ToAddresses = [email] },
            Content = new EmailContent { Simple = new Message
            {
                Subject = new Content { Data = "RecruiterReply password recovery" },
                Body = new Body { Text = new Content { Data =
                    $"Your RecruiterReply verification code is:\n\n{code}\n\nIt expires in 10 minutes. You can also open this recovery link:\n{link}\n\nIf you did not request this, ignore this message." } }
            } }
        }, ct);
    }
}
