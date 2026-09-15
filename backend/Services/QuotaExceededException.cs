namespace RecruiterReply.Services;

public class QuotaExceededException : Exception
{
    public QuotaExceededException(string message) : base(message)
    {
    }
}
