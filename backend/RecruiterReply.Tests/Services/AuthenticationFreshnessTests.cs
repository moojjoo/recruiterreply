using System.Text.Json;
using RecruiterReply.Services;

namespace RecruiterReply.Tests.Services;

public sealed class AuthenticationFreshnessTests
{
    private static readonly DateTimeOffset Now = DateTimeOffset.FromUnixTimeSeconds(1800000000);

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("garbage")]
    [InlineData("1.2")]
    [InlineData("-1")]
    [InlineData("999999999999999999")]
    [InlineData("1800000001")]
    public void InvalidSignedTimesNeverGrantFreshness(string? value)
    {
        Assert.Null(AuthenticationFreshness.ReadSignedAuthTime(value, Now));
        Assert.False(AuthenticationFreshness.IsRecent(AuthenticationFreshness.ReadSignedAuthTime(value, Now), Now));
    }

    [Theory]
    [InlineData(0, true)]
    [InlineData(900, true)]
    [InlineData(901, false)]
    [InlineData(3600, false)]
    public void FreshnessUsesOriginalAuthenticationTime(int age, bool expected)
    {
        var original = Now.AddSeconds(-age);
        var parsed = AuthenticationFreshness.ReadSignedAuthTime(original.ToUnixTimeSeconds().ToString(), Now);
        Assert.Equal(original, parsed);
        Assert.Equal(expected, AuthenticationFreshness.IsRecent(parsed, Now));
    }

    [Fact]
    public void OldSerializedSessionsHaveNoAuthenticationProof()
    {
        var session = new BffSession(Guid.NewGuid(), "subject", "https://issuer.test", "client",
            "read", Now, Now, Now.AddMinutes(30), Now.AddHours(8), "synthetic", null);
        var json = JsonSerializer.SerializeToNode(session)!.AsObject();
        json.Remove("AuthenticatedAt");
        var restored = JsonSerializer.Deserialize<BffSession>(json.ToJsonString())!;
        Assert.Equal(session.UserId, restored.UserId);
        Assert.Null(restored.AuthenticatedAt);
        Assert.False(AuthenticationFreshness.IsRecent(restored.AuthenticatedAt, Now));
    }

    [Fact]
    public void SerializedSessionsPreserveOriginalTimeAcrossNewIssuance()
    {
        var original = Now.AddHours(-1);
        var session = new BffSession(Guid.NewGuid(), "subject", "https://issuer.test", "client",
            "read", Now, Now, Now.AddMinutes(30), Now.AddHours(8), "synthetic", null, original);
        var restored = JsonSerializer.Deserialize<BffSession>(JsonSerializer.Serialize(session))!;
        Assert.Equal(original, restored.AuthenticatedAt);
        Assert.False(AuthenticationFreshness.IsRecent(restored.AuthenticatedAt, Now));
    }
}
