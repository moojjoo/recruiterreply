using RecruiterReply.Observability;

namespace RecruiterReply.Tests.Observability;

public sealed class FrontendTelemetryValidationTests
{
    [Fact]
    public void TryNormalize_AllowsSafeLowCardinalityFields()
    {
        var input = new FrontendTelemetryEvent(
            "ApiRequestFailed", "Warning", "abc123", "/dashboard",
            new Dictionary<string, string> { ["statusCode"] = "503", ["component"] = "api" });

        Assert.True(FrontendTelemetryValidation.TryNormalize(input, out var normalized));
        Assert.Equal("503", normalized.Metadata!["statusCode"]);
    }

    [Theory]
    [InlineData("recruiter message")]
    [InlineData("header\nvalue")]
    [InlineData("https://example.test/?token=secret")]
    public void TryNormalize_RejectsSensitiveOrInjectionLikeValues(string value)
    {
        var input = new FrontendTelemetryEvent(
            "ApiRequestFailed", "Error", "trace", "/dashboard",
            new Dictionary<string, string> { ["component"] = value });

        Assert.False(FrontendTelemetryValidation.TryNormalize(input, out _));
    }

    [Fact]
    public void TryNormalize_RejectsQueryStringsAndUnexpectedFields()
    {
        var query = new FrontendTelemetryEvent("ApiRequestFailed", "Warning", "trace", "/x?token=secret", null);
        var unexpected = new FrontendTelemetryEvent("ApiRequestFailed", "Warning", "trace", "/x",
            new Dictionary<string, string> { ["message"] = "secret" });

        Assert.False(FrontendTelemetryValidation.TryNormalize(query, out _));
        Assert.False(FrontendTelemetryValidation.TryNormalize(unexpected, out _));
    }
}
