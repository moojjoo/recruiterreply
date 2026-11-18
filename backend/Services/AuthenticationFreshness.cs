using System.Globalization;

namespace RecruiterReply.Services;

// Call only after token signature, issuer, audience and lifetime validation.
internal static class AuthenticationFreshness
{
    internal static DateTimeOffset? ReadSignedAuthTime(string? value, DateTimeOffset now)
    {
        if (!long.TryParse(value, NumberStyles.None, CultureInfo.InvariantCulture, out var seconds))
            return null;
        try
        {
            var time = DateTimeOffset.FromUnixTimeSeconds(seconds);
            return time <= now ? time : null;
        }
        catch (ArgumentOutOfRangeException) { return null; }
    }

    internal static bool IsRecent(DateTimeOffset? time, DateTimeOffset now)
        => time is not null && time <= now && now - time <= TimeSpan.FromMinutes(15);
}
