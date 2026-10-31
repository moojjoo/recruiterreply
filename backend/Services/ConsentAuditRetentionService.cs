using Microsoft.EntityFrameworkCore;
using RecruiterReply.Data;

namespace RecruiterReply.Services;

// Daily best-effort cleanup; retention can be configured per environment.
// The database migration is additive; deletion only affects expired consent audit rows.
public sealed class ConsentAuditRetentionService(IServiceScopeFactory scopeFactory, IConfiguration config, ILogger<ConsentAuditRetentionService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromHours(24));
        do
        {
            try
            {
                var days = config.GetValue("ConsentAudit:RetentionDays", 365);
                if (days < 30 || days > 3650)
                {
                    logger.LogWarning("Consent audit retention must be between 30 and 3650 days");
                    continue;
                }
                using var scope = scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<RecruiterReplyDbContext>();
                await db.ConsentAuditEvents.Where(e => e.CreatedAt < TimeProvider.System.GetUtcNow().UtcDateTime.AddDays(-days))
                    .ExecuteDeleteAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex) { logger.LogWarning(ex, "Consent audit retention cleanup failed"); }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
