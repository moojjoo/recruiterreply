using System.Threading.Channels;

namespace RecruiterReply.Observability;

public sealed class FrontendTelemetryQueue : BackgroundService
{
    private readonly Channel<FrontendTelemetryEvent> _events = Channel.CreateBounded<FrontendTelemetryEvent>(
        new BoundedChannelOptions(256) { FullMode = BoundedChannelFullMode.DropWrite, SingleReader = true });
    private readonly ILogger<FrontendTelemetryQueue> _logger;

    public FrontendTelemetryQueue(ILogger<FrontendTelemetryQueue> logger) => _logger = logger;

    public bool TryEnqueue(FrontendTelemetryEvent item) => _events.Writer.TryWrite(item);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var item in _events.Reader.ReadAllAsync(stoppingToken))
        {
            _logger.Log(
                item.Severity.Equals("Error", StringComparison.OrdinalIgnoreCase) ? LogLevel.Error : LogLevel.Warning,
                "Frontend diagnostic event {EventName} source={Source} traceId={TraceId} route={Route} metadata={Metadata}",
                item.EventName, "frontend", item.TraceId ?? "none", item.Route ?? "unknown", item.Metadata);
        }
    }
}
