using System.Text;
using RecruiterReply.Entities;
using RecruiterReply.Models;
using RecruiterReply.Services;

namespace RecruiterReply.Tests.Services;

public class GmailDraftTests
{
    [Fact]
    public void BuildMimeReply_ThreadsReplyAndStripsHeaderInjection()
    {
        var mime = GmailApiClient.BuildMimeReply(new GmailDraftReply(
            "t1", "jane@staffing.com\r\nBcc: evil@x.com", "Contract role", "<abc@mail>", "<root@mail>", "Hello"));

        Assert.Contains("To: jane@staffing.com  Bcc: evil@x.com\r\n", mime);
        Assert.DoesNotContain("\r\nBcc:", mime);
        Assert.Contains("In-Reply-To: <abc@mail>\r\n", mime);
        Assert.Contains("References: <root@mail> <abc@mail>\r\n", mime);
        var subject = Convert.ToBase64String(Encoding.UTF8.GetBytes("Re: Contract role"));
        Assert.Contains($"Subject: =?UTF-8?B?{subject}?=", mime);
        Assert.EndsWith(Convert.ToBase64String(Encoding.UTF8.GetBytes("Hello")), mime);
    }

    [Fact]
    public void BuildMimeReply_DoesNotDoublePrefixSubject()
    {
        var mime = GmailApiClient.BuildMimeReply(new GmailDraftReply("t1", "a@b.com", "RE: hi", null, null, "x"));
        var subject = Convert.ToBase64String(Encoding.UTF8.GetBytes("RE: hi"));
        Assert.Contains(subject, mime);
        Assert.DoesNotContain("In-Reply-To", mime);
    }

    [Theory]
    [InlineData("https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.compose", true)]
    [InlineData("https://www.googleapis.com/auth/gmail.readonly", false)]
    [InlineData(null, false)]
    public void CanWrite_RequiresModifyAndCompose(string? granted, bool expected)
    {
        Assert.Equal(expected, GmailScopes.CanWrite(granted));
    }

    [Fact]
    public void TriageReplyPrompt_HidesRatesUnlessDisclosureAllowed()
    {
        var profile = new CareerProfileEntity { MinC2CHourlyRate = 95, WorkModes = ["remote"] };
        var context = new TriageReplyContext(TriageStates.NeedsInfo, ["rate"], [], profile, "Jane", "Role", "body");

        var hidden = OpenAIService.BuildTriageReplyPrompt(context);
        Assert.DoesNotContain("95", hidden);
        Assert.Contains("Never state a specific rate", hidden);
        Assert.Contains("the pay rate or salary range", hidden);

        profile.DiscloseMinRate = true;
        var shown = OpenAIService.BuildTriageReplyPrompt(context);
        Assert.Contains("Minimum C2C rate: $95/hr", shown);
    }

    [Fact]
    public void TriageReplyPrompt_ForIgnoredState_Throws()
    {
        var context = new TriageReplyContext(TriageStates.Ignored, [], [], null, null, "s", "b");
        Assert.Throws<ArgumentOutOfRangeException>(() => OpenAIService.BuildTriageReplyPrompt(context));
    }
}
