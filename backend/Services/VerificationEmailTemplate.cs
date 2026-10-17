using System.Net;
using System.Text;

namespace RecruiterReply.Services;

/// <summary>
/// Presentation-only verification email renderer. The identity provider owns code generation,
/// verification, expiry, throttling and replay protection. Never log rendered messages.
/// </summary>
public static class VerificationEmailTemplate
{
    public enum Purpose { Signup, PasswordReset, DevAccess, TestAccess }

    public sealed record Email(string Subject, string Html, string PlainText);

    public static Email Render(Purpose purpose, string code, int expirationMinutes)
    {
        if (string.IsNullOrWhiteSpace(code) || code.Length != 6 || !code.All(char.IsAsciiDigit))
            throw new ArgumentException("A six-digit verification code is required.", nameof(code));
        if (expirationMinutes < 1 || expirationMinutes > 60)
            throw new ArgumentOutOfRangeException(nameof(expirationMinutes));

        var (subject, instruction) = purpose switch
        {
            Purpose.Signup => ("Verify your RecruiterReply email", "Use this code to verify your email address."),
            Purpose.PasswordReset => ("Reset your RecruiterReply password", "Use this code to reset your password."),
            Purpose.DevAccess => ("RecruiterReply Dev access code", "Use this code to verify your Dev environment sign-in."),
            Purpose.TestAccess => ("RecruiterReply Test access code", "Use this code to verify your Test environment sign-in."),
            _ => throw new ArgumentOutOfRangeException(nameof(purpose))
        };

        var cells = new StringBuilder();
        foreach (var digit in code)
        {
            cells.Append("<td style=\"padding:4px\"><span style=\"display:block;background:#f1f5f9;border-radius:7px;padding:12px 9px;color:#0f172a;font-size:26px;font-weight:600\">")
                .Append(WebUtility.HtmlEncode(digit.ToString()))
                .Append("</span></td>");
        }

        // A clipboard button cannot reliably work inside an HTML email: clients disable scripts.
        // The contiguous code is also provided as selectable text and in the text/plain part.
        var html = $"""
            <!doctype html>
            <html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
            <body style="margin:0;padding:24px;background:#edf2f7;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
              <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;padding:28px">
                <div style="font-size:22px;font-weight:700;color:#0369a1">RecruiterReply</div>
                <h1 style="font-size:24px;line-height:1.3;color:#0f172a">Your verification code</h1>
                <p style="font-size:16px;line-height:1.6;color:#334155">{WebUtility.HtmlEncode(instruction)}</p>
                <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;text-align:center"><tr>{cells}</tr></table>
                <p style="font-size:16px;color:#334155">Copy or select this code: <strong style="font-family:monospace;letter-spacing:2px;user-select:all">{code}</strong></p>
                <p style="font-size:14px;color:#475569">This code expires in {expirationMinutes} minutes. Never share it with anyone.</p>
                <p style="font-size:14px;color:#475569">If you didn't request this code, you can ignore this email.</p>
                <hr style="border:0;border-top:1px solid #e2e8f0">
                <p style="font-size:12px;color:#64748b">RecruiterReply · Secure account verification</p>
              </div>
            </body></html>
            """;
        var plain = $"RecruiterReply — {subject}\n\n{instruction}\n\nYour code: {code}\n\nExpires in {expirationMinutes} minutes. Never share this code.\nIf you didn't request it, ignore this email.";
        return new Email(subject, html, plain);
    }
}
