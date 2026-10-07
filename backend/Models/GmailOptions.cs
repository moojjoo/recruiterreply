namespace RecruiterReply.Models;

public class GmailOptions
{
    public string ClientId { get; set; } = string.Empty;
    public string ClientSecret { get; set; } = string.Empty;
    public string RedirectUri { get; set; } = string.Empty;
    public string FrontendCallbackUrl { get; set; } = string.Empty;
    public string[] Scopes { get; set; } = [];
    public int PollingIntervalSeconds { get; set; } = 180;
    public int MaxConcurrentConnections { get; set; } = 3;
    public string DataProtectionKeysPath { get; set; } = "keys";

    /// <summary>Configured scopes plus the ones the recruiter autopilot always needs.</summary>
    public string[] EffectiveScopes => Scopes.Union(GmailScopes.Required).ToArray();
}

public static class GmailScopes
{
    /// <summary>Read mail and apply labels. Restricted scope: needs Google verification + CASA for public launch.</summary>
    public const string Modify = "https://www.googleapis.com/auth/gmail.modify";
    /// <summary>Create drafts. Restricted scope.</summary>
    public const string Compose = "https://www.googleapis.com/auth/gmail.compose";

    public static readonly string[] Required = [Modify, Compose];

    /// <summary>Connections made before drafts/labels shipped only granted read access and must reconnect.</summary>
    public static bool CanWrite(string? grantedScopes)
    {
        var granted = (grantedScopes ?? string.Empty).Split(' ', StringSplitOptions.RemoveEmptyEntries);
        return Required.All(granted.Contains);
    }
}
