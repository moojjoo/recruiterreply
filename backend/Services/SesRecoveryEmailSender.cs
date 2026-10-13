using System.Net;
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

        // Encode all dynamic content: codes and links are untrusted input for HTML contexts.
        var safeCode = WebUtility.HtmlEncode(code);
        var safeLink = WebUtility.HtmlEncode(link);
        var text = $"Your RecruiterReply verification code is:\n\n{code}\n\nIt expires in 10 minutes. You can also open this recovery link:\n{link}\n\nIf you did not request this, ignore this message.";
        var html = $"""
            <!doctype html>
            <html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
            <body style="margin:0;padding:24px;background:#f3f6fb;color:#172033;font-family:Arial,Helvetica,sans-serif">
              <main style="max-width:520px;margin:0 auto;padding:28px;background:#ffffff;border-radius:12px">
                <h1 style="font-size:24px;margin:0 0 16px">RecruiterReply</h1>
                <p>Use this one-time code to reset your password:</p>
                <p style="font-size:34px;font-weight:700;letter-spacing:6px;line-height:1.4;user-select:text" aria-label="Verification code"><strong>{safeCode}</strong></p>
                <p>Select and copy the code above, then paste it into the password reset page.</p>
                <p>This code expires in <strong>10 minutes</strong>.</p>
                <p>Alternatively, <a href="{safeLink}">open your secure password recovery link</a>.</p>
                <p style="font-size:13px;color:#526074">If you did not request this, you can ignore this email.</p>
              </main>
            </body></html>
            """;
        using var ses = new AmazonSimpleEmailServiceV2Client();
        await ses.SendEmailAsync(new SendEmailRequest
        {
            FromEmailAddress = from,
            Destination = new Destination { ToAddresses = [email] },
            Content = new EmailContent { Simple = new Message
            {
                Subject = new Content { Data = "RecruiterReply password recovery" },
                Body = new Body
                {
                    Text = new Content { Data = text, Charset = "UTF-8" },
                    Html = new Content { Data = html, Charset = "UTF-8" }
                }
            } }
        }, ct);
    }
}
