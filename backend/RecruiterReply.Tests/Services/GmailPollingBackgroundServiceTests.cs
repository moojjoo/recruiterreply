using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using RecruiterReply.Entities;
using RecruiterReply.Models;
using RecruiterReply.Repositories;
using RecruiterReply.Services;

namespace RecruiterReply.Tests.Services;

public class GmailPollingBackgroundServiceTests
{
    private static GmailPollingBackgroundService CreateSut(
        Mock<IGmailConnectionRepository> connectionRepository,
        Mock<IGmailSyncService> syncService)
    {
        var services = new ServiceCollection();
        services.AddSingleton(connectionRepository.Object);
        services.AddSingleton(syncService.Object);
        var provider = services.BuildServiceProvider();

        return new GmailPollingBackgroundService(
            provider.GetRequiredService<IServiceScopeFactory>(),
            Options.Create(new GmailOptions { MaxConcurrentConnections = 5 }),
            NullLogger<GmailPollingBackgroundService>.Instance);
    }

    private static GmailConnectionEntity BuildConnection() => new()
    {
        Id = Guid.NewGuid(),
        UserId = Guid.NewGuid(),
        Status = "active",
        GoogleAccountEmail = "user@example.com",
        AccessTokenEncrypted = "enc",
        RefreshTokenEncrypted = "enc",
        GrantedScopes = "scope",
    };

    [Fact]
    public async Task PollAllConnectionsAsync_WithNoActiveConnections_NeverCallsSync()
    {
        var connectionRepository = new Mock<IGmailConnectionRepository>();
        connectionRepository.Setup(r => r.GetActiveConnectionsAsync(It.IsAny<CancellationToken>())).ReturnsAsync([]);
        var syncService = new Mock<IGmailSyncService>();
        var sut = CreateSut(connectionRepository, syncService);

        await sut.PollAllConnectionsAsync(CancellationToken.None);

        syncService.Verify(s => s.SyncConnectionAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task PollAllConnectionsAsync_SyncsEachActiveConnectionOnce()
    {
        var connections = new List<GmailConnectionEntity> { BuildConnection(), BuildConnection(), BuildConnection() };
        var connectionRepository = new Mock<IGmailConnectionRepository>();
        connectionRepository.Setup(r => r.GetActiveConnectionsAsync(It.IsAny<CancellationToken>())).ReturnsAsync(connections);
        var syncService = new Mock<IGmailSyncService>();
        var sut = CreateSut(connectionRepository, syncService);

        await sut.PollAllConnectionsAsync(CancellationToken.None);

        foreach (var connection in connections)
        {
            syncService.Verify(s => s.SyncConnectionAsync(connection.Id, It.IsAny<CancellationToken>()), Times.Once);
        }
    }

    [Fact]
    public async Task PollAllConnectionsAsync_WhenOneConnectionSyncThrows_StillSyncsTheOthers()
    {
        var failing = BuildConnection();
        var succeeding = BuildConnection();
        var connectionRepository = new Mock<IGmailConnectionRepository>();
        connectionRepository.Setup(r => r.GetActiveConnectionsAsync(It.IsAny<CancellationToken>())).ReturnsAsync([failing, succeeding]);
        var syncService = new Mock<IGmailSyncService>();
        syncService.Setup(s => s.SyncConnectionAsync(failing.Id, It.IsAny<CancellationToken>())).ThrowsAsync(new InvalidOperationException("boom"));
        var sut = CreateSut(connectionRepository, syncService);

        await sut.PollAllConnectionsAsync(CancellationToken.None);

        syncService.Verify(s => s.SyncConnectionAsync(succeeding.Id, It.IsAny<CancellationToken>()), Times.Once);
    }
}
