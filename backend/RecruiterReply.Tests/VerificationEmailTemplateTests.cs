using RecruiterReply.Services;

namespace RecruiterReply.Tests;

public class VerificationEmailTemplateTests
{
    [Theory]
    [InlineData(VerificationEmailTemplate.Purpose.Signup, "Verify your RecruiterReply email")]
    [InlineData(VerificationEmailTemplate.Purpose.PasswordReset, "Reset your RecruiterReply password")]
    [InlineData(VerificationEmailTemplate.Purpose.DevAccess, "RecruiterReply Dev access code")]
    [InlineData(VerificationEmailTemplate.Purpose.TestAccess, "RecruiterReply Test access code")]
    public void RendersAccessibleMultipartCode(VerificationEmailTemplate.Purpose purpose, string subject)
    {
        var result = VerificationEmailTemplate.Render(purpose, "001234", 10);
        Assert.Equal(subject, result.Subject);
        Assert.Contains("001234", result.Html);
        Assert.Contains("001234", result.PlainText);
        Assert.Contains("10 minutes", result.Html);
        Assert.Contains("10 minutes", result.PlainText);
        Assert.Contains("<table", result.Html);
        Assert.DoesNotContain("<script", result.Html, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("Copy code</button>", result.Html);
    }

    [Theory]
    [InlineData("12345")]
    [InlineData("1234567")]
    [InlineData("12a456")]
    [InlineData("")]
    public void RejectsInvalidCodes(string code)
    {
        Assert.Throws<ArgumentException>(() => VerificationEmailTemplate.Render(
            VerificationEmailTemplate.Purpose.Signup, code, 10));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(61)]
    public void RejectsInvalidExpiry(int minutes)
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => VerificationEmailTemplate.Render(
            VerificationEmailTemplate.Purpose.PasswordReset, "123456", minutes));
    }
}
