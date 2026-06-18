using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RecruiterReply.Data;
using RecruiterReply.Entities;
using RecruiterReply.Services;

namespace RecruiterReply.Controllers;

[ApiController]
[Route("api/messages")]
public class MessagesController : ControllerBase
{
    private readonly RecruiterReplyDbContext _db;
    private readonly IDefaultUserService _defaultUserService;

    public MessagesController(RecruiterReplyDbContext db, IDefaultUserService defaultUserService)
    {
        _db = db;
        _defaultUserService = defaultUserService;
    }

    [HttpGet]
    public async Task<IActionResult> GetMessages(CancellationToken ct)
    {
        var userId = await _defaultUserService.GetOrCreateDefaultUserIdAsync(ct);
        var messages = await _db.Messages
            .AsNoTracking()
            .Where(m => m.UserId == userId)
            .OrderByDescending(m => m.CreatedAt)
            .ToListAsync(ct);

        return Ok(messages);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetMessage(Guid id, CancellationToken ct)
    {
        var userId = await _defaultUserService.GetOrCreateDefaultUserIdAsync(ct);
        var message = await _db.Messages
            .AsNoTracking()
            .FirstOrDefaultAsync(m => m.Id == id && m.UserId == userId, ct);

        return message is null ? NotFound() : Ok(message);
    }

    [HttpPost]
    public async Task<IActionResult> CreateMessage([FromBody] MessageEntity request, CancellationToken ct)
    {
        var userId = await _defaultUserService.GetOrCreateDefaultUserIdAsync(ct);

        var message = new MessageEntity
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Subject = request.Subject,
            Body = request.Body,
            SenderEmail = request.SenderEmail,
            SenderName = request.SenderName,
            CompanyName = request.CompanyName,
            ReceivedDate = request.ReceivedDate,
            CreatedAt = DateTime.UtcNow
        };

        _db.Messages.Add(message);
        await _db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetMessage), new { id = message.Id }, message);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateMessage(Guid id, [FromBody] MessageEntity request, CancellationToken ct)
    {
        var userId = await _defaultUserService.GetOrCreateDefaultUserIdAsync(ct);
        var message = await _db.Messages.FirstOrDefaultAsync(m => m.Id == id && m.UserId == userId, ct);

        if (message is null)
        {
            return NotFound();
        }

        message.Subject = request.Subject;
        message.Body = request.Body;
        message.SenderEmail = request.SenderEmail;
        message.SenderName = request.SenderName;
        message.CompanyName = request.CompanyName;
        message.ReceivedDate = request.ReceivedDate;

        await _db.SaveChangesAsync(ct);
        return Ok(message);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteMessage(Guid id, CancellationToken ct)
    {
        var userId = await _defaultUserService.GetOrCreateDefaultUserIdAsync(ct);
        var message = await _db.Messages.FirstOrDefaultAsync(m => m.Id == id && m.UserId == userId, ct);

        if (message is null)
        {
            return NotFound();
        }

        _db.Messages.Remove(message);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}
