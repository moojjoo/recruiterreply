using System.Net;

namespace RecruiterReply.Services;

/// <summary>Pure rendering of the SES multipart password-recovery email; never log the result.</summary>
public static class RecoveryEmailTemplate
{
    public static (string Text, string Html) Render(string code, string link)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(code);
        ArgumentException.ThrowIfNullOrWhiteSpace(link);
        var safeCode = WebUtility.HtmlEncode(code);
        var safeLink = WebUtility.HtmlEncode(link);
        var text = $"""
            RecruiterReply

            Verify your email address

            Enter the following verification code to finish resetting your RecruiterReply password.

            YOUR VERIFICATION CODE

            {code}

            Copy this six-digit code and paste it into the password reset page.

            This code expires in 10 minutes. If you did not request this code, you can ignore this email.

            You can also open this secure password recovery link:
            {link}

            RecruiterReply.com — Simplifying your job search.
            """;
        var html = $"""
            <!doctype html>
            <html lang="en">
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width,initial-scale=1">
              <title>RecruiterReply verification code</title>
            </head>
            <body style="margin:0;padding:24px;background:#f3f6fb;color:#172033;font-family:Arial,Helvetica,sans-serif;line-height:1.5">
              <main style="max-width:560px;margin:0 auto;padding:32px;background:#ffffff;border:1px solid #dbe3ef;border-radius:12px">
                <p style="margin:0 0 20px;font-size:20px;font-weight:700;color:#1d4ed8">RecruiterReply</p>
                <h1 style="margin:0 0 16px;font-size:26px;line-height:1.25">Verify your email address</h1>
                <p style="margin:0 0 24px">Enter the following verification code to finish resetting your RecruiterReply password.</p>
                <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:1.4px;color:#526074">YOUR VERIFICATION CODE</p>
                <p aria-label="Verification code" style="margin:0 0 16px;padding:18px;border-radius:10px;background:#eef4ff;color:#172033;font-size:34px;font-weight:700;letter-spacing:8px;text-align:center;user-select:all;-webkit-user-select:all"><strong>{safeCode}</strong></p>
                <p style="margin:0 0 20px;color:#526074">Select the six-digit code above, copy it, and paste it into the password reset page.</p>
                <p style="margin:0 0 12px">This code expires in <strong>10 minutes</strong>.</p>
                <p style="margin:0 0 20px">Alternatively, <a href="{safeLink}" style="color:#1d4ed8">open your secure password recovery link</a>.</p>
                <p style="margin:0 0 24px;font-size:13px;color:#526074">If you did not request this code, you can ignore this email.</p>
                <p style="margin:0;padding-top:18px;border-top:1px solid #dbe3ef;font-size:13px;color:#526074">RecruiterReply.com &mdash; Simplifying your job search.</p>
              </main>
            </body>
            </html>
            """;
        return (text, html);
    }
}
