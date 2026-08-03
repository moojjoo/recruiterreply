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
}
