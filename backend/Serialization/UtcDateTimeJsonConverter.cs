using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;

namespace RecruiterReply.Serialization;

public sealed class UtcDateTimeJsonConverter : JsonConverter<DateTime>
{
    private static readonly Regex IsoInstant = new(
        "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,7})?(?:Z|[+-]\\d{2}:\\d{2})$",
        RegexOptions.CultureInvariant);

    public override DateTime Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType != JsonTokenType.String)
        {
            throw new JsonException("A timestamp must be a JSON string.");
        }

        var value = reader.GetString() ?? throw new JsonException("A timestamp is required.");
        if (!IsoInstant.IsMatch(value) ||
            !DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var instant))
        {
            throw new JsonException("Timestamps must be ISO 8601 instants with Z or an explicit offset.");
        }

        return instant.UtcDateTime;
    }

    public override void Write(Utf8JsonWriter writer, DateTime value, JsonSerializerOptions options)
    {
        if (value.Kind == DateTimeKind.Unspecified)
        {
            throw new JsonException("Cannot serialize an ambiguous DateTime without a UTC or local kind.");
        }

        writer.WriteStringValue(value.ToUniversalTime().ToString("O", CultureInfo.InvariantCulture));
    }
}

public sealed class UtcDateTimeOffsetJsonConverter : JsonConverter<DateTimeOffset>
{
    private static readonly Regex IsoInstant = new(
        "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,7})?(?:Z|[+-]\\d{2}:\\d{2})$",
        RegexOptions.CultureInvariant);

    public override DateTimeOffset Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType != JsonTokenType.String)
        {
            throw new JsonException("A timestamp must be a JSON string.");
        }

        var value = reader.GetString() ?? throw new JsonException("A timestamp is required.");
        if (!DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var instant) ||
            !IsoInstant.IsMatch(value))
        {
            throw new JsonException("Timestamps must be ISO 8601 instants with Z or an explicit offset.");
        }

        return instant.ToUniversalTime();
    }

    public override void Write(Utf8JsonWriter writer, DateTimeOffset value, JsonSerializerOptions options) =>
        writer.WriteStringValue(value.UtcDateTime.ToString("O", CultureInfo.InvariantCulture));
}
