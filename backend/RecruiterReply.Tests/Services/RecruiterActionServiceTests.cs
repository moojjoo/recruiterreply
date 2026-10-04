using System.Text.Json;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using RecruiterReply.Entities;
using RecruiterReply.Models;
using RecruiterReply.Services;

namespace RecruiterReply.Tests.Services;

public class RecruiterActionServiceTests
{
    private readonly Mock<IGmailApiClient> _apiClient = new();
    private readonly Mock<IOpenAIService> _openAI = new();
    private readonly RecruiterActionService _sut;
    private readonly GmailConnectionEntity _connection = new()
    {
        UserId = Guid.NewGuid(),
        GrantedScopes = $"{GmailScopes.Modify} {GmailScopes.Compose}",
    };
    private readonly RecruiterThreadEntity _thread = new() { Id = Guid.NewGuid(), GmailThreadId = "t1" };

    public RecruiterActionServiceTests()
    {
        _sut = new RecruiterActionService(_apiClient.Object, _openAI.Object, NullLogger<RecruiterActionService>.Instance);
        _apiClient.Setup(a => a.EnsureLabelAsync("token", It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((string _, string name, CancellationToken _) => $"id:{name}");
        _apiClient.Setup(a => a.CreateDraftReplyAsync("token", It.IsAny<GmailDraftReply>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync("draft-1");
        _openAI.Setup(o => o.GenerateTriageReplyAsync(It.IsAny<TriageReplyContext>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync("Hi Jane, what is the rate?");
    }

    private static GmailMessageDetail Inbound(bool sentByUser = false) =>
        new("m1", "t1", "Contract role", "Jane <jane@staffing.com>", "jobs@staffing.com", "<abc@mail>", "<root@mail>", DateTime.UtcNow, sentByUser, "body");

    private static TriageDecision Decision(string state) => new(state, state == TriageStates.NeedsInfo ? ["rate"] : [], []);

    private Task Apply(string state, GmailMessageDetail? message = null, CareerProfileEntity? profile = null) =>
        _sut.ApplyAsync(_connection, "token", _thread, message ?? Inbound(), Decision(state), new RecruiterFacts { IsRecruiter = true }, profile);

    [Fact]
    public async Task WithoutWriteScopes_DoesNothing()
    {
        _connection.GrantedScopes = "https://www.googleapis.com/auth/gmail.readonly";

        await Apply(TriageStates.NeedsInfo);

        _apiClient.VerifyNoOtherCalls();
        _openAI.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task WhenPaused_DoesNothing()
    {
        await Apply(TriageStates.NeedsInfo, profile: new CareerProfileEntity { Paused = true });

        _apiClient.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task LabelsThreadWithStateAndRemovesOtherStateLabels()
    {
        await Apply(TriageStates.NeedsInfo);

        _apiClient.Verify(a => a.ModifyThreadLabelsAsync("token", "t1",
            It.Is<IReadOnlyList<string>>(add => add.SequenceEqual(new[] { "id:RecruiterReply/Needs info" })),
            It.Is<IReadOnlyList<string>>(remove => remove.Count == 2 && !remove.Contains("id:RecruiterReply")),
            It.IsAny<CancellationToken>()), Times.Once);
        var cached = JsonSerializer.Deserialize<Dictionary<string, string>>(_connection.LabelIds!);
        Assert.Equal(4, cached!.Count);
    }

    [Fact]
    public async Task UsesCachedLabelIds()
    {
        _connection.LabelIds = JsonSerializer.Serialize(new Dictionary<string, string>
        {
            ["RecruiterReply"] = "p",
            ["RecruiterReply/Qualified"] = "q",
            ["RecruiterReply/Needs info"] = "n",
            ["RecruiterReply/Below bar"] = "b",
        });

        await Apply(TriageStates.Qualified);

        _apiClient.Verify(a => a.EnsureLabelAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task DraftsThreadedReplyToReplyToAddress()
    {
        await Apply(TriageStates.NeedsInfo);

        _apiClient.Verify(a => a.CreateDraftReplyAsync("token", It.Is<GmailDraftReply>(d =>
            d.ThreadId == "t1" && d.To == "jobs@staffing.com" && d.InReplyTo == "<abc@mail>" && d.References == "<root@mail>"
            && d.Body == "Hi Jane, what is the rate?"), It.IsAny<CancellationToken>()), Times.Once);
        Assert.Equal("draft-1", _thread.DraftId);
        Assert.NotNull(_thread.DraftCreatedAt);
    }

    [Fact]
    public async Task ReplacesPreviousDraft()
    {
        _thread.DraftId = "old-draft";

        await Apply(TriageStates.Qualified);

        _apiClient.Verify(a => a.DeleteDraftAsync("token", "old-draft", It.IsAny<CancellationToken>()), Times.Once);
        Assert.Equal("draft-1", _thread.DraftId);
    }

    [Fact]
    public async Task OutboundMessage_LabelsButDoesNotDraft()
    {
        await Apply(TriageStates.NeedsInfo, Inbound(sentByUser: true));

        _apiClient.Verify(a => a.ModifyThreadLabelsAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<IReadOnlyList<string>>(), It.IsAny<IReadOnlyList<string>>(), It.IsAny<CancellationToken>()), Times.Once);
        _apiClient.Verify(a => a.CreateDraftReplyAsync(It.IsAny<string>(), It.IsAny<GmailDraftReply>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task LabelFailure_ClearsCacheAndStillDrafts()
    {
        _connection.LabelIds = "{}";
        _apiClient.Setup(a => a.ModifyThreadLabelsAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<IReadOnlyList<string>>(), It.IsAny<IReadOnlyList<string>>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("label gone"));

        await Apply(TriageStates.BelowBar);

        Assert.Null(_connection.LabelIds);
        Assert.Equal("draft-1", _thread.DraftId);
    }
}
