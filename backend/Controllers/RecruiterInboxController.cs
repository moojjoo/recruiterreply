using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RecruiterReply.Entities;
using RecruiterReply.Extensions;
using RecruiterReply.Models;
using RecruiterReply.Repositories;
using RecruiterReply.Services;

namespace RecruiterReply.Controllers;

[ApiController]
[Route("api/recruiter-inbox")]
[Authorize]
public class RecruiterInboxController : ControllerBase
{
    private readonly IRecruiterInboxRepository _repository;

    public RecruiterInboxController(IRecruiterInboxRepository repository)
    {
        _repository = repository;
    }

    [HttpGet("threads")]
    public async Task<ActionResult<List<RecruiterThreadDto>>> List([FromQuery] string? state, CancellationToken ct)
    {
        var threads = await _repository.ListThreadsAsync(User.GetRequiredUserId(), state, ct);
        return Ok(threads.Select(ToDto).ToList());
    }

    [HttpGet("threads/{id:guid}")]
    public async Task<ActionResult<RecruiterThreadDto>> Get(Guid id, CancellationToken ct)
    {
        var thread = await _repository.GetThreadAsync(User.GetRequiredUserId(), id, ct);
        return thread is null ? NotFound() : Ok(ToDto(thread));
    }

    private static RecruiterThreadDto ToDto(RecruiterThreadEntity t) => new()
    {
        Id = t.Id,
        GmailThreadId = t.GmailThreadId,
        Subject = t.Subject,
        RecruiterEmail = t.RecruiterEmail,
        State = t.State,
        Facts = Deserialize<RecruiterFacts>(t.Facts),
        MissingFields = Deserialize<List<string>>(t.MissingFields) ?? [],
        Reasons = Deserialize<List<string>>(t.Reasons) ?? [],
        HasDraft = !string.IsNullOrEmpty(t.DraftId),
        DraftCreatedAt = t.DraftCreatedAt,
        LastMessageAt = t.LastMessageAt,
    };

    private static T? Deserialize<T>(string? json) where T : class =>
        string.IsNullOrEmpty(json) ? null : JsonSerializer.Deserialize<T>(json);
}
