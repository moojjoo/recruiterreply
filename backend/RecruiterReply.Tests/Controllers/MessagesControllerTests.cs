using Microsoft.AspNetCore.Mvc;
using RecruiterReply.Controllers;
using RecruiterReply.Entities;
using RecruiterReply.Tests.Testing;

namespace RecruiterReply.Tests.Controllers;

public class MessagesControllerTests
{
    private readonly RecruiterReply.Data.RecruiterReplyDbContext _db = TestDb.Create();
    private readonly MessagesController _sut;
    private readonly Guid _userId = Guid.NewGuid();

    public MessagesControllerTests()
    {
        _sut = new MessagesController(_db);
        _sut.SetUser(_userId);
    }

    private async Task<MessageEntity> SeedMessage(Guid userId, string body = "hello")
    {
        var message = new MessageEntity { Id = Guid.NewGuid(), UserId = userId, Body = body, CreatedAt = DateTime.UtcNow };
        _db.Messages.Add(message);
        await _db.SaveChangesAsync();
        return message;
    }

    [Fact]
    public async Task GetMessages_ReturnsOnlyTheAuthenticatedUsersMessages()
    {
        await SeedMessage(_userId);
        await SeedMessage(Guid.NewGuid());

        var result = await _sut.GetMessages(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var messages = Assert.IsAssignableFrom<List<MessageEntity>>(ok.Value);
        Assert.Single(messages);
    }

    [Fact]
    public async Task GetMessage_WithOwnMessage_ReturnsIt()
    {
        var message = await SeedMessage(_userId);

        var result = await _sut.GetMessage(message.Id, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal(message.Id, ((MessageEntity)ok.Value!).Id);
    }

    [Fact]
    public async Task GetMessage_WithAnotherUsersMessage_ReturnsNotFound()
    {
        var message = await SeedMessage(Guid.NewGuid());

        var result = await _sut.GetMessage(message.Id, CancellationToken.None);

        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task GetMessage_WithUnknownId_ReturnsNotFound()
    {
        var result = await _sut.GetMessage(Guid.NewGuid(), CancellationToken.None);

        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task CreateMessage_PersistsUnderAuthenticatedUser()
    {
        var request = new MessageEntity { Subject = "Subj", Body = "Body text", CompanyName = "Acme" };

        var result = await _sut.CreateMessage(request, CancellationToken.None);

        var created = Assert.IsType<CreatedAtActionResult>(result);
        var message = Assert.IsType<MessageEntity>(created.Value);
        Assert.Equal(_userId, message.UserId);
        Assert.Equal(1, _db.Messages.Count());
    }

    [Fact]
    public async Task UpdateMessage_WithOwnMessage_UpdatesFields()
    {
        var message = await SeedMessage(_userId, "old body");

        var result = await _sut.UpdateMessage(message.Id, new MessageEntity { Subject = "New", Body = "new body" }, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal("new body", ((MessageEntity)ok.Value!).Body);
    }

    [Fact]
    public async Task UpdateMessage_WithAnotherUsersMessage_ReturnsNotFound()
    {
        var message = await SeedMessage(Guid.NewGuid());

        var result = await _sut.UpdateMessage(message.Id, new MessageEntity { Body = "hijacked" }, CancellationToken.None);

        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task DeleteMessage_WithOwnMessage_RemovesIt()
    {
        var message = await SeedMessage(_userId);

        var result = await _sut.DeleteMessage(message.Id, CancellationToken.None);

        Assert.IsType<NoContentResult>(result);
        Assert.Equal(0, _db.Messages.Count());
    }

    [Fact]
    public async Task DeleteMessage_WithAnotherUsersMessage_ReturnsNotFoundAndDoesNotDelete()
    {
        var message = await SeedMessage(Guid.NewGuid());

        var result = await _sut.DeleteMessage(message.Id, CancellationToken.None);

        Assert.IsType<NotFoundResult>(result);
        Assert.Equal(1, _db.Messages.Count());
    }
}
