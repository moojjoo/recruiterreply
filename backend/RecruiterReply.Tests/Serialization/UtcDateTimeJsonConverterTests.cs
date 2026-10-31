using System.Text.Json;
using RecruiterReply.Serialization;

namespace RecruiterReply.Tests.Serialization;

public sealed class UtcDateTimeJsonConverterTests
{
    private static JsonSerializerOptions Options()
    {
        var options = new JsonSerializerOptions();
        options.Converters.Add(new UtcDateTimeJsonConverter());
        options.Converters.Add(new UtcDateTimeOffsetJsonConverter());
        return options;
    }

    [Fact]
    public void DateTime_ExplicitOffset_IsNormalizedToUtc()
    {
        var value = JsonSerializer.Deserialize<DateTime>("\"2026-03-08T01:30:00-05:00\"", Options());

        Assert.Equal(DateTimeKind.Utc, value.Kind);
        Assert.Equal(new DateTime(2026, 3, 8, 6, 30, 0, DateTimeKind.Utc), value);
    }

    [Fact]
    public void DateTime_NaiveInput_IsRejected()
    {
        Assert.Throws<JsonException>(() =>
            JsonSerializer.Deserialize<DateTime>("\"2026-03-08T01:30:00\"", Options()));
    }

    [Theory]
    [InlineData("\"03/08/2026 01:30:00 -05:00\"")]
    [InlineData("123")]
    [InlineData("true")]
    public void DateTime_NonIsoOrNonStringInput_IsRejectedAsJson(string json)
    {
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<DateTime>(json, Options()));
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<DateTimeOffset>(json, Options()));
    }

    [Fact]
    public void DateTime_Output_AlwaysHasUtcSuffix()
    {
        var json = JsonSerializer.Serialize(
            new DateTime(2026, 3, 8, 6, 30, 0, DateTimeKind.Utc), Options());

        Assert.EndsWith("Z\"", json, StringComparison.Ordinal);
    }
}
