using RecruiterReply.Services;

namespace RecruiterReply.Tests.Services;

public class RecruiterPrefilterTests
{
    private static GmailMessageDetail Message(string subject, string body, string from = "jane@staffing.com", bool sent = false) =>
        new("m1", "t1", subject, from, null, DateTime.UtcNow, sent, body);

    [Fact]
    public void RecruiterOutreach_Passes()
    {
        var message = Message("Remote .NET contract opportunity", "Hi, I have a C2C role with a great rate.");
        Assert.True(RecruiterPrefilter.LooksLikeRecruiterEmail(message, "me@gmail.com"));
    }

    [Fact]
    public void Newsletter_IsFiltered()
    {
        var message = Message("Your weekly digest", "Here are this week's top stories.");
        Assert.False(RecruiterPrefilter.LooksLikeRecruiterEmail(message, "me@gmail.com"));
    }

    [Fact]
    public void UsersOwnMail_IsFiltered()
    {
        var message = Message("Re: contract role", "What is the rate for this position?", from: "Me <me@gmail.com>");
        Assert.False(RecruiterPrefilter.LooksLikeRecruiterEmail(message, "me@gmail.com"));
    }

    [Fact]
    public void SentMail_IsFiltered()
    {
        var message = Message("contract role", "position rate", sent: true);
        Assert.False(RecruiterPrefilter.LooksLikeRecruiterEmail(message, "me@gmail.com"));
    }
}
