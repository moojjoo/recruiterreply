using RecruiterReply.Services;

namespace RecruiterReply.Tests.Services;

public class RecoveryEmailTemplateTests
{
    [Fact]
    public void RendersSelectableCodeInBothEmailParts()
    {
        var (text, html) = RecoveryEmailTemplate.Render("123456", "https://recruiterreply.com/recover");
        Assert.Contains("123456", text);
        Assert.Contains("<strong>123456</strong>", html);
        Assert.Contains("10 minutes", text);
        Assert.Contains("10 minutes", html);
        Assert.Contains("https://recruiterreply.com/recover", text);
        Assert.Contains("https://recruiterreply.com/recover", html);
        Assert.Contains("lang=\"en\"", html);
        Assert.DoesNotContain("<button", html, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("<script", html, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void EncodesUntrustedValuesInHtml()
    {
        var (text, html) = RecoveryEmailTemplate.Render("<123&456>", "https://example.test/reset?a=1&b=\"bad\"");
        Assert.Contains("<123&456>", text);
        Assert.Contains("&lt;123&amp;456&gt;", html);
        Assert.DoesNotContain("<strong><123&456>", html);
        Assert.Contains("a=1&amp;b=&quot;bad&quot;", html);
    }

    [Theory]
    [InlineData("", "https://example.test")]
    [InlineData("123456", "")]
    public void RejectsEmptyInputs(string code, string link)
    {
        Assert.Throws<ArgumentException>(() => RecoveryEmailTemplate.Render(code, link));
    }
}
