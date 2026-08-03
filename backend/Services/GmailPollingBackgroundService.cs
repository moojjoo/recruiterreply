using Microsoft.Extensions.Options;
using RecruiterReply.Models;
using RecruiterReply.Repositories;

namespace RecruiterReply.Services;

/// <summary>
/// The project's first IHostedService. Periodically syncs every active Gmail connection.
/// Runs inside the same backend process as everything else — the current deployment topology
/// is one dedicated backend instance per environment, so no distributed lock is needed.
/// </summary>
public class GmailPollingBackgroundService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly GmailOptions _options;
    private readonly ILogger<GmailPollingBackgroundService> _logger;

    public GmailPollingBackgroundService(
        IServiceScopeFactory scopeFactory,
        IOptions<GmailOptions> options,
        ILogger<GmailPollingBackgroundService> logger)
    {
        _scopeFactory = scopeFactory;
        _options = options.Value;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var interval = TimeSpan.FromSeconds(Math.Max(_options.PollingIntervalSeconds, 30));
        using var timer = new PeriodicTimer(interval);

        do
        {
            try
            {
                await PollAllConnectionsAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Gmail polling cycle failed unexpectedly");
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    private async Task PollAllConnectionsAsync(CancellationToken stoppingToken)
    {
        List<Entities.GmailConnectionEntity> activeConnections;
        using (var scope = _scopeFactory.CreateScope())
        {
            var connectionRepository = scope.ServiceProvider.GetRequiredService<IGmailConnectionRepository>();
            activeConnections = await connectionRepository.GetActiveConnectionsAsync(stoppingToken);
        }

        if (activeConnections.Count == 0)
        {
            return;
        }

        using var semaphore = new SemaphoreSlim(Math.Max(_options.MaxConcurrentConnections, 1));

        var tasks = activeConnections.Select(async connection =>
        {
            await semaphore.WaitAsync(stoppingToken);
            try
            {
                // Each connection gets its own scope so its DbContext isn't shared across
                // concurrently-running syncs.
                using var connectionScope = _scopeFactory.CreateScope();
                var syncService = connectionScope.ServiceProvider.GetRequiredService<IGmailSyncService>();
                await syncService.SyncConnectionAsync(connection.Id, stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unhandled error syncing Gmail connection {ConnectionId}", connection.Id);
            }
            finally
            {
                semaphore.Release();
            }
        });

        await Task.WhenAll(tasks);
    }
}
