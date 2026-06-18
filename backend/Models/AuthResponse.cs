namespace RecruiterReply.Models;

public class AuthResponse
{
    public string Token { get; set; } = string.Empty;
    public AuthUserDto User { get; set; } = new();
}
