using Google.Apis.Auth.OAuth2.Responses;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using RecruiterReply.Entities;
using RecruiterReply.Repositories;
using RecruiterReply.Services;

namespace RecruiterReply.Tests.Services;

public class GmailSyncServiceTests
{
    private readonly Mock<IGmailConnectionRepository> _connectionRepository = new();
    private readonly Mock<IGmailOAuthService> _oAuthService = new();
    private readonly Mock<IGmailApiClient> _apiClient = new();
    private readonly GmailSyncService _sut;

    public GmailSyncServiceTests()
    {
        _sut = new GmailSyncService(_connectionRepository.Object, _oAuthService.Object, _apiClient.Object, NullLogger<GmailSyncService>.Instance);
    }

    private static GmailConnectionEntity BuildConnection(string status = "active", string? historyId = null) => new()
    {
        Id = Guid.NewGuid(),
        UserId = Guid.NewGuid(),
        Status = status,
        HistoryId = historyId,
        GoogleAccountEmail = "user@example.com",
        AccessTokenEncrypted = "enc-access",
        RefreshTokenEncrypted = "enc-refresh",
        GrantedScopes = "scope",
    };

    [Fact]
    public async Task SyncConnectionAsync_WithMissingConnection_IsNoOp()
    {
        var connectionId = Guid.NewGuid();
        _connectionRepository.Setup(r => r.GetByIdAsync(connectionId, It.IsAny<CancellationToken>())).ReturnsAsync((GmailConnectionEntity?)null);

        await _sut.SyncConnectionAsync(connectionId);

        _oAuthService.Verify(o => o.GetValidAccessTokenAsync(It.IsAny<GmailConnectionEntity>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task SyncConnectionAsync_WithInactiveConnection_IsNoOp()
    {
        var connection = BuildConnection(status: "disconnected");
        _connectionRepository.Setup(r => r.GetByIdAsync(connection.Id, It.IsAny<CancellationToken>())).ReturnsAsync(connection);

        await _sut.SyncConnectionAsync(connection.Id);

        _oAuthService.Verify(o => o.GetValidAccessTokenAsync(It.IsAny<GmailConnectionEntity>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task SyncConnectionAsync_WithNoHistoryId_UsesRecentInboxBaseline()
    {
        var connection = BuildConnection(historyId: null);
        _connectionRepository.Setup(r => r.GetByIdAsync(connection.Id, It.IsAny<CancellationToken>())).ReturnsAsync(connection);
        _oAuthService.Setup(o => o.GetValidAccessTokenAsync(connection, It.IsAny<CancellationToken>())).ReturnsAsync("access-token");
        _apiClient.Setup(a => a.ListRecentInboxMessageIdsAsync("access-token", It.IsAny<CancellationToken>())).ReturnsAsync(["msg1"]);
        _apiClient.Setup(a => a.GetMessageSummaryAsync("access-token", "msg1", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new GmailMessageSummary("msg1", "thread1", "Subject", "from@example.com"));
        _apiClient.Setup(a => a.GetProfileHistoryIdAsync("access-token", It.IsAny<CancellationToken>())).ReturnsAsync("history-100");

        await _sut.SyncConnectionAsync(connection.Id);

        _apiClient.Verify(a => a.ListMessageIdsSinceHistoryAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        Assert.Equal("history-100", connection.HistoryId);
        Assert.Equal("ok", connection.LastSyncStatus);
        Assert.NotNull(connection.LastSyncedAt);
        _connectionRepository.Verify(r => r.UpdateAsync(connection, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task SyncConnectionAsync_WithHistoryId_UsesHistorySinceListing()
    {
        var connection = BuildConnection(historyId: "history-50");
        _connectionRepository.Setup(r => r.GetByIdAsync(connection.Id, It.IsAny<CancellationToken>())).ReturnsAsync(connection);
        _oAuthService.Setup(o => o.GetValidAccessTokenAsync(connection, It.IsAny<CancellationToken>())).ReturnsAsync("access-token");
        _apiClient.Setup(a => a.ListMessageIdsSinceHistoryAsync("access-token", "history-50", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new GmailHistoryResult { HistoryExpired = false, MessageIds = ["msg2"] });
        _apiClient.Setup(a => a.GetMessageSummaryAsync("access-token", "msg2", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new GmailMessageSummary("msg2", "thread2", "Subject2", "from2@example.com"));
        _apiClient.Setup(a => a.GetProfileHistoryIdAsync("access-token", It.IsAny<CancellationToken>())).ReturnsAsync("history-200");

        await _sut.SyncConnectionAsync(connection.Id);

        _apiClient.Verify(a => a.ListRecentInboxMessageIdsAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        Assert.Equal("history-200", connection.HistoryId);
    }

    [Fact]
    public async Task SyncConnectionAsync_WhenHistoryExpired_FallsBackToRecentInboxBaseline()
    {
        var connection = BuildConnection(historyId: "history-stale");
        _connectionRepository.Setup(r => r.GetByIdAsync(connection.Id, It.IsAny<CancellationToken>())).ReturnsAsync(connection);
        _oAuthService.Setup(o => o.GetValidAccessTokenAsync(connection, It.IsAny<CancellationToken>())).ReturnsAsync("access-token");
        _apiClient.Setup(a => a.ListMessageIdsSinceHistoryAsync("access-token", "history-stale", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new GmailHistoryResult { HistoryExpired = true, MessageIds = [] });
        _apiClient.Setup(a => a.ListRecentInboxMessageIdsAsync("access-token", It.IsAny<CancellationToken>())).ReturnsAsync([]);
        _apiClient.Setup(a => a.GetProfileHistoryIdAsync("access-token", It.IsAny<CancellationToken>())).ReturnsAsync("history-300");

        await _sut.SyncConnectionAsync(connection.Id);

        _apiClient.Verify(a => a.ListRecentInboxMessageIdsAsync("access-token", It.IsAny<CancellationToken>()), Times.Once);
        Assert.Equal("history-300", connection.HistoryId);
        Assert.Equal("ok", connection.LastSyncStatus);
    }

    [Fact]
    public async Task SyncConnectionAsync_OnTokenResponseException_MarksConnectionAsAuthError()
    {
        var connection = BuildConnection();
        _connectionRepository.Setup(r => r.GetByIdAsync(connection.Id, It.IsAny<CancellationToken>())).ReturnsAsync(connection);
        _oAuthService.Setup(o => o.GetValidAccessTokenAsync(connection, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new TokenResponseException(new TokenErrorResponse { Error = "invalid_grant" }));

        await _sut.SyncConnectionAsync(connection.Id);

        Assert.Equal("error", connection.Status);
        Assert.Equal("auth_error", connection.LastSyncStatus);
        _connectionRepository.Verify(r => r.UpdateAsync(connection, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task SyncConnectionAsync_OnUnexpectedException_MarksLastSyncStatusErrorWithoutChangingConnectionStatus()
    {
        var connection = BuildConnection();
        _connectionRepository.Setup(r => r.GetByIdAsync(connection.Id, It.IsAny<CancellationToken>())).ReturnsAsync(connection);
        _oAuthService.Setup(o => o.GetValidAccessTokenAsync(connection, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("boom"));

        await _sut.SyncConnectionAsync(connection.Id);

        Assert.Equal("active", connection.Status);
        Assert.Equal("error", connection.LastSyncStatus);
        Assert.Equal("boom", connection.LastSyncError);
    }
}
