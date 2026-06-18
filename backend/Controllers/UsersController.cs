using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RecruiterReply.Data;
using RecruiterReply.Services;

namespace RecruiterReply.Controllers;

[ApiController]
[Route("api/users")]
public class UsersController : ControllerBase
{
    private readonly RecruiterReplyDbContext _db;
    private readonly IDefaultUserService _defaultUserService;

    public UsersController(RecruiterReplyDbContext db, IDefaultUserService defaultUserService)
    {
        _db = db;
        _defaultUserService = defaultUserService;
    }

    [HttpGet]
    public async Task<IActionResult> GetUsers(CancellationToken ct)
    {
        var users = await _db.Users
            .AsNoTracking()
            .Select(u => new
            {
                u.Id,
                u.Email,
                u.FirstName,
                u.LastName,
                u.IsActive,
                u.CreatedAt,
                u.UpdatedAt
            })
            .ToListAsync(ct);

        return Ok(users);
    }

    [HttpGet("default")]
    public async Task<IActionResult> GetOrCreateDefaultUser(CancellationToken ct)
    {
        var userId = await _defaultUserService.GetOrCreateDefaultUserIdAsync(ct);
        var user = await _db.Users
            .AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => new
            {
                u.Id,
                u.Email,
                u.FirstName,
                u.LastName,
                u.IsActive,
                u.CreatedAt,
                u.UpdatedAt
            })
            .FirstAsync(ct);

        return Ok(user);
    }
}
