using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using RecruiterReply.Controllers;
using RecruiterReply.Data;
using RecruiterReply.Entities;
using RecruiterReply.Models;
using RecruiterReply.Services;
using RecruiterReply.Tests.Testing;

namespace RecruiterReply.Tests.Controllers;

public class AuthControllerTests
{
    private readonly Mock<IGoogleAuthService> _googleAuthService = new();
    private readonly PasswordHashService _passwordHashService = new();
    private readonly JwtTokenService _jwtTokenService;
    private readonly RecruiterReplyDbContext _db = TestDb.Create();
    private readonly AuthController _sut;

    public AuthControllerTests()
    {
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Jwt:Key"] = "a-sufficiently-long-test-signing-key-1234567890",
            ["Frontend:BaseUrl"] = "http://localhost:5173",
        }).Build();

        _jwtTokenService = new JwtTokenService(config);
        _sut = new AuthController(_db, _passwordHashService, _jwtTokenService, _googleAuthService.Object, config, NullLogger<AuthController>.Instance);
    }

    private async Task<UserEntity> SeedUser(string email, string password, bool isActive = true)
    {
        var user = new UserEntity
        {
            Id = Guid.NewGuid(),
            Email = email,
            PasswordHash = _passwordHashService.HashPassword(password),
            IsActive = isActive,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        _db.Users.Add(user);
        await _db.SaveChangesAsync();
        return user;
    }

    // ----- Register -----

    [Fact]
    public async Task Register_WithMissingFields_Returns400()
    {
        var result = await _sut.Register(new AuthRegisterRequest { Email = "", Password = "" }, CancellationToken.None);

        Assert.Equal(400, Assert.IsType<BadRequestObjectResult>(result).StatusCode);
    }

    [Fact]
    public async Task Register_WithDuplicateEmail_Returns409()
    {
        await SeedUser("taken@example.com", "Password123!");

        var result = await _sut.Register(
            new AuthRegisterRequest { Email = "taken@example.com", Password = "Password123!", Name = "Jane" }, CancellationToken.None);

        Assert.Equal(409, Assert.IsType<ConflictObjectResult>(result).StatusCode);
    }

    [Fact]
    public async Task Register_WithNewUser_CreatesUserAndReturnsToken()
    {
        var result = await _sut.Register(
            new AuthRegisterRequest { Email = "New@Example.com", Password = "Password123!", Name = "Jane Doe" }, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<AuthResponse>(ok.Value);
        Assert.Equal("new@example.com", response.User.Email);
        Assert.Equal("Jane Doe", response.User.Name);
        Assert.NotEmpty(response.Token);
        Assert.Equal(1, _db.Users.Count());
    }

    // ----- Login -----

    [Fact]
    public async Task Login_WithMissingFields_Returns400()
    {
        var result = await _sut.Login(new AuthLoginRequest { Email = "", Password = "" }, CancellationToken.None);

        Assert.Equal(400, Assert.IsType<BadRequestObjectResult>(result).StatusCode);
    }

    [Fact]
    public async Task Login_WithWrongPassword_Returns401()
    {
        await SeedUser("jane@example.com", "correct-password");

        var result = await _sut.Login(new AuthLoginRequest { Email = "jane@example.com", Password = "wrong" }, CancellationToken.None);

        Assert.Equal(401, Assert.IsType<UnauthorizedObjectResult>(result).StatusCode);
    }

    [Fact]
    public async Task Login_WithUnknownEmail_Returns401()
    {
        var result = await _sut.Login(new AuthLoginRequest { Email = "nobody@example.com", Password = "x" }, CancellationToken.None);

        Assert.Equal(401, Assert.IsType<UnauthorizedObjectResult>(result).StatusCode);
    }

    [Fact]
    public async Task Login_WithInactiveUser_Returns401()
    {
        await SeedUser("inactive@example.com", "Password123!", isActive: false);

        var result = await _sut.Login(new AuthLoginRequest { Email = "inactive@example.com", Password = "Password123!" }, CancellationToken.None);

        Assert.Equal(401, Assert.IsType<UnauthorizedObjectResult>(result).StatusCode);
    }

    [Fact]
    public async Task Login_WithCorrectCredentials_ReturnsToken()
    {
        var user = await SeedUser("jane@example.com", "correct-password");

        var result = await _sut.Login(new AuthLoginRequest { Email = "jane@example.com", Password = "correct-password" }, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<AuthResponse>(ok.Value);
        Assert.Equal(user.Id, response.User.Id);
    }

    // ----- Google start/callback -----

    [Fact]
    public void GoogleStart_OnSuccess_ReturnsRedirectUrl()
    {
        _googleAuthService.Setup(s => s.BuildAuthorizationUrl()).Returns("https://accounts.google.com/o/oauth2/v2/auth?client_id=x");

        var result = _sut.GoogleStart();

        Assert.IsType<OkObjectResult>(result);
    }

    [Fact]
    public void GoogleStart_WhenMisconfigured_Returns400()
    {
        _googleAuthService.Setup(s => s.BuildAuthorizationUrl()).Throws(new InvalidOperationException("not configured"));

        var result = _sut.GoogleStart();

        Assert.Equal(400, Assert.IsType<BadRequestObjectResult>(result).StatusCode);
    }

    [Fact]
    public async Task GoogleCallback_WithMissingCode_RedirectsWithError()
    {
        var result = await _sut.GoogleCallback(null!, CancellationToken.None);

        var redirect = Assert.IsType<RedirectResult>(result);
        Assert.Contains("error=google_auth_failed", redirect.Url);
    }

    [Fact]
    public async Task GoogleCallback_OnSuccess_RedirectsWithToken()
    {
        _googleAuthService.Setup(s => s.ExchangeCodeForTokenAsync("good-code", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AuthResponse { Token = "jwt-token", User = new AuthUserDto { Email = "jane@example.com" } });

        var result = await _sut.GoogleCallback("good-code", CancellationToken.None);

        var redirect = Assert.IsType<RedirectResult>(result);
        Assert.Contains("token=jwt-token", redirect.Url);
    }

    [Fact]
    public async Task GoogleCallback_WhenExchangeFails_RedirectsWithError()
    {
        _googleAuthService.Setup(s => s.ExchangeCodeForTokenAsync("bad-code", It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("exchange failed"));

        var result = await _sut.GoogleCallback("bad-code", CancellationToken.None);

        var redirect = Assert.IsType<RedirectResult>(result);
        Assert.Contains("error=google_auth_failed", redirect.Url);
    }

    // ----- Me -----

    [Fact]
    public async Task Me_WithExistingActiveUser_ReturnsUserDto()
    {
        var user = await SeedUser("jane@example.com", "Password123!");
        _sut.SetUser(user.Id);

        var result = await _sut.Me(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var dto = Assert.IsType<AuthUserDto>(ok.Value);
        Assert.Equal(user.Id, dto.Id);
    }

    [Fact]
    public async Task Me_WithUnknownUser_ReturnsNotFound()
    {
        _sut.SetUser(Guid.NewGuid());

        var result = await _sut.Me(CancellationToken.None);

        Assert.IsType<NotFoundObjectResult>(result);
    }
}
