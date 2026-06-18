using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using RecruiterReply.Data;
using RecruiterReply.Extensions;

namespace RecruiterReply.Controllers;

[ApiController]
[Route("api/users")]
[Authorize]
public class UsersController : ControllerBase
{
    private readonly RecruiterReplyDbContext _db;

    public UsersController(RecruiterReplyDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> GetUsers(CancellationToken ct)
    {
        var userId = User.GetRequiredUserId();
        var users = await _db.Users
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
            .ToListAsync(ct);

        return Ok(users);
    }

    [HttpGet("me")]
    public async Task<IActionResult> GetMe(CancellationToken ct)
    {
        var userId = User.GetRequiredUserId();
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
