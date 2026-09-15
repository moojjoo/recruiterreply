using RecruiterReply.Services;

namespace RecruiterReply.Tests.Services;

public class PasswordHashServiceTests
{
    private readonly PasswordHashService _sut = new();

    [Fact]
    public void HashPassword_ThenVerifyPassword_RoundTripsSuccessfully()
    {
        var hash = _sut.HashPassword("correct horse battery staple");

        Assert.True(_sut.VerifyPassword("correct horse battery staple", hash));
    }

    [Fact]
    public void VerifyPassword_WithWrongPassword_ReturnsFalse()
    {
        var hash = _sut.HashPassword("correct horse battery staple");

        Assert.False(_sut.VerifyPassword("wrong password", hash));
    }

    [Theory]
    [InlineData("")]
    [InlineData("not-a-valid-hash")]
    [InlineData("only:one-part-but-not-base64:::")]
    public void VerifyPassword_WithMalformedHash_ReturnsFalseInsteadOfThrowing(string malformedHash)
    {
        Assert.False(_sut.VerifyPassword("anything", malformedHash));
    }

    [Fact]
    public void VerifyPassword_WithEmptyPassword_ReturnsFalse()
    {
        var hash = _sut.HashPassword("something");

        Assert.False(_sut.VerifyPassword("", hash));
    }

    [Fact]
    public void HashPassword_ProducesDifferentHashesForSamePassword()
    {
        var first = _sut.HashPassword("same password");
        var second = _sut.HashPassword("same password");

        Assert.NotEqual(first, second);
    }

    [Fact]
    public void HashPassword_WithEmptyPassword_Throws()
    {
        Assert.Throws<ArgumentException>(() => _sut.HashPassword(""));
    }
}
