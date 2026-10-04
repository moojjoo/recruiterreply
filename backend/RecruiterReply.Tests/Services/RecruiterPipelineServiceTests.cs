using System.Text.Json;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using RecruiterReply.Entities;
using RecruiterReply.Models;
using RecruiterReply.Repositories;
using RecruiterReply.Services;

namespace RecruiterReply.Tests.Services;

public class RecruiterPipelineServiceTests
{
    private readonly Mock<IRecruiterInboxRepository> _repository = new();
    private readonly Mock<IGmailApiClient> _apiClient = new();
    private readonly Mock<IOpenAIService> _openAI = new();
    private readonly Mock<IUsageService> _usage = new();
    private readonly RecruiterPipelineService _sut;
    private readonly GmailConnectionEntity _connection = new() { Id = Guid.NewGuid(), UserId = Guid.NewGuid(), GoogleAccountEmail = "me@gmail.com" };
    private readonly List<RecruiterEmailEntity> _savedEmails = [];

    public RecruiterPipelineServiceTests()
    {
        _sut = new RecruiterPipelineService(_repository.Object, _apiClient.Object, _openAI.Object, _usage.Object, NullLogger<RecruiterPipelineService>.Instance);
        _repository.Setup(r => r.AddEmailAsync(It.IsAny<RecruiterEmailEntity>(), It.IsAny<CancellationToken>()))
            .Callback<RecruiterEmailEntity, CancellationToken>((e, _) => _savedEmails.Add(e));
    }

    private void GivenMessage(string subject, string body, string threadId = "t1") =>
        _apiClient.Setup(a => a.GetMessageFullAsync("token", "m1", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new GmailMessageDetail("m1", threadId, subject, "Jane <jane@staffing.com>", null, DateTime.UtcNow, false, body));

    private void GivenExtracted(RecruiterFacts facts) =>
        _openAI.Setup(o => o.ExtractRecruiterFactsAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(facts);

    [Fact]
    public async Task AlreadyClaimedMessage_IsNoOp()
    {
        _repository.Setup(r => r.EmailExistsAsync(_connection.UserId, "m1", It.IsAny<CancellationToken>())).ReturnsAsync(true);

        await _sut.ProcessMessageAsync(_connection, "token", "m1");

        _apiClient.Verify(a => a.GetMessageFullAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task NonRecruiterEmail_IsSkippedWithoutCallingLlm()
    {
        GivenMessage("Your receipt", "Thanks for your purchase.");

        await _sut.ProcessMessageAsync(_connection, "token", "m1");

        Assert.Equal("skipped", Assert.Single(_savedEmails).Status);
        _openAI.Verify(o => o.ExtractRecruiterFactsAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task QuotaExceeded_RecordsStatusWithoutCallingLlm()
    {
        GivenMessage("Contract opportunity", "C2C role, remote");
        _usage.Setup(u => u.EnsureWithinQuotaAsync(_connection.UserId, UsageFeatures.AutoTriage, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new QuotaExceededException("limit"));

        await _sut.ProcessMessageAsync(_connection, "token", "m1");

        Assert.Equal("quota_exceeded", Assert.Single(_savedEmails).Status);
        _openAI.Verify(o => o.ExtractRecruiterFactsAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task RecruiterEmail_CreatesTriagedThreadAndCountsUsage()
    {
        GivenMessage("Contract opportunity", "C2C role, remote");
        GivenExtracted(new RecruiterFacts { IsRecruiter = true, EmploymentType = "c2c", WorkMode = "remote" });
        RecruiterThreadEntity? saved = null;
        _repository.Setup(r => r.SaveThreadAsync(It.IsAny<RecruiterThreadEntity>(), It.IsAny<CancellationToken>()))
            .Callback<RecruiterThreadEntity, CancellationToken>((t, _) => saved = t);

        await _sut.ProcessMessageAsync(_connection, "token", "m1");

        Assert.NotNull(saved);
        Assert.Equal(TriageStates.NeedsInfo, saved.State);
        Assert.Equal("jane@staffing.com", saved.RecruiterEmail);
        Assert.Equal([RecruiterFactFields.Rate], JsonSerializer.Deserialize<List<string>>(saved.MissingFields!));
        var email = Assert.Single(_savedEmails);
        Assert.Equal("processed", email.Status);
        Assert.Equal(saved.Id, email.ThreadId);
        _usage.Verify(u => u.IncrementUsageAsync(_connection.UserId, UsageFeatures.AutoTriage, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task FollowUpOnTrackedThread_MergesFactsAndReevaluates()
    {
        var thread = new RecruiterThreadEntity
        {
            Id = Guid.NewGuid(),
            UserId = _connection.UserId,
            GmailThreadId = "t1",
            State = TriageStates.NeedsInfo,
            Facts = JsonSerializer.Serialize(new RecruiterFacts { IsRecruiter = true, EmploymentType = "c2c", WorkMode = "remote" }),
        };
        _repository.Setup(r => r.GetThreadByGmailIdAsync(_connection.UserId, "t1", It.IsAny<CancellationToken>())).ReturnsAsync(thread);
        _repository.Setup(r => r.GetProfileAsync(_connection.UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CareerProfileEntity { MinC2CHourlyRate = 90 });
        // A short reply wouldn't pass the keyword pre-filter on its own; tracked threads bypass it.
        GivenMessage("Re: hi", "It pays 100/hr");
        GivenExtracted(new RecruiterFacts { IsRecruiter = false, RateMax = 100, RateUnit = "hour" });

        await _sut.ProcessMessageAsync(_connection, "token", "m1");

        Assert.Equal(TriageStates.Qualified, thread.State);
        Assert.Equal(thread.Id, Assert.Single(_savedEmails).ThreadId);
    }

    [Fact]
    public async Task ExtractionFailure_RecordsErrorAndDoesNotCountUsage()
    {
        GivenMessage("Contract opportunity", "C2C role, remote");
        _openAI.Setup(o => o.ExtractRecruiterFactsAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("bad json"));

        await _sut.ProcessMessageAsync(_connection, "token", "m1");

        Assert.Equal("error", Assert.Single(_savedEmails).Status);
        _usage.Verify(u => u.IncrementUsageAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }
}
