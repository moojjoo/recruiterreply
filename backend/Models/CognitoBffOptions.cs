namespace RecruiterReply.Models;

public sealed class CognitoBffOptions
{
    public bool Enabled { get; set; }
    public bool CsrfEnabled { get; set; }
    public string Issuer { get; set; } = string.Empty;
    public string ResourceIdentifier { get; set; } = string.Empty;
    public string ClientId { get; set; } = string.Empty;
    public string ClientSecret { get; set; } = string.Empty;
    public string Domain { get; set; } = string.Empty;
    public string RedirectUri { get; set; } = string.Empty;
    public string PostLogoutRedirectUri { get; set; } = string.Empty;
    public string SessionTableName { get; set; } = string.Empty;
    public string SessionKmsKeyId { get; set; } = string.Empty;
    public int IdleMinutes { get; set; } = 30;
    public int AbsoluteHours { get; set; } = 8;
}
