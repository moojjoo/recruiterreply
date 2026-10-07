using Google.Apis.Auth.OAuth2.Responses;
using RecruiterReply.Repositories;

namespace RecruiterReply.Services;

/// <summary>
/// Pulls new inbox messages for a connection and hands each one to the recruiter pipeline
/// (claim/extract/evaluate). Still read-only with respect to Gmail; drafts + labeling come later.
/// </summary>
public class GmailSyncService : IGmailSyncService
{
    private readonly IGmailConnectionRepository _connectionRepository;
    private readonly IGmailOAuthService _oAuthService;
    private readonly IGmailApiClient _apiClient;
    private readonly IRecruiterPipelineService _pipeline;
    private readonly ILogger<GmailSyncService> _logger;

    public GmailSyncService(
        IGmailConnectionRepository connectionRepository,
        IGmailOAuthService oAuthService,
        IGmailApiClient apiClient,
        IRecruiterPipelineService pipeline,
        ILogger<GmailSyncService> logger)
    {
        _pipeline = pipeline;
        _connectionRepository = connectionRepository;
        _oAuthService = oAuthService;
        _apiClient = apiClient;
        _logger = logger;
    }

    public async Task SyncConnectionAsync(Guid connectionId, CancellationToken cancellationToken = default)
    {
        var connection = await _connectionRepository.GetByIdAsync(connectionId, cancellationToken);
        if (connection is null || connection.Status != "active")
        {
            return;
        }

        try
        {
            var accessToken = await _oAuthService.GetValidAccessTokenAsync(connection, cancellationToken);

            IReadOnlyList<string> messageIds;
            if (string.IsNullOrEmpty(connection.HistoryId))
            {
                messageIds = await _apiClient.ListRecentInboxMessageIdsAsync(accessToken, cancellationToken);
            }
            else
            {
                var historyResult = await _apiClient.ListMessageIdsSinceHistoryAsync(accessToken, connection.HistoryId, cancellationToken);
                if (historyResult.HistoryExpired)
                {
                    _logger.LogWarning(
                        "Gmail history expired for connection {ConnectionId}; falling back to recent-message baseline",
                        connectionId);
                    messageIds = await _apiClient.ListRecentInboxMessageIdsAsync(accessToken, cancellationToken);
                }
                else
                {
                    messageIds = historyResult.MessageIds;
                }
            }

            foreach (var messageId in messageIds)
            {
                try
                {
                    await _pipeline.ProcessMessageAsync(connection, accessToken, messageId, cancellationToken);
                }
                catch (Exception ex) when (ex is not TokenResponseException and not OperationCanceledException)
                {
                    // One bad message must not block the rest of the batch or stall the history cursor.
                    _logger.LogError(ex, "Recruiter pipeline failed for message {MessageId} on connection {ConnectionId}", messageId, connectionId);
                }
            }

            var newHistoryId = await _apiClient.GetProfileHistoryIdAsync(accessToken, cancellationToken);

            connection.HistoryId = newHistoryId;
            connection.LastSyncedAt = DateTime.UtcNow;
            connection.LastSyncStatus = "ok";
            connection.LastSyncError = null;
            connection.UpdatedAt = DateTime.UtcNow;
            await _connectionRepository.UpdateAsync(connection, cancellationToken);
        }
        catch (TokenResponseException ex)
        {
            // Refresh token was revoked/expired — this connection can't self-heal, so stop
            // retrying it every poll cycle until the user reconnects via the UI.
            _logger.LogWarning(ex, "Gmail refresh token invalid for connection {ConnectionId}; marking auth_error", connectionId);

            connection.Status = "error";
            connection.LastSyncStatus = "auth_error";
            connection.LastSyncError = ex.Message;
            connection.UpdatedAt = DateTime.UtcNow;
            await _connectionRepository.UpdateAsync(connection, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Gmail sync failed for connection {ConnectionId}", connectionId);

            connection.LastSyncStatus = "error";
            connection.LastSyncError = ex.Message;
            connection.UpdatedAt = DateTime.UtcNow;
            await _connectionRepository.UpdateAsync(connection, cancellationToken);
        }
    }
}
