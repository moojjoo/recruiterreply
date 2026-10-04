using Google;
using Google.Apis.Auth.OAuth2;
using Google.Apis.Gmail.v1;
using Google.Apis.Gmail.v1.Data;
using Google.Apis.Services;
using Google.Apis.Util;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;

namespace RecruiterReply.Services;

public class GmailApiClient : IGmailApiClient
{
    private const string ApplicationName = "RecruiterReply";

    public async Task<string> GetProfileHistoryIdAsync(string accessToken, CancellationToken cancellationToken = default)
    {
        using var service = CreateService(accessToken);
        var profile = await service.Users.GetProfile("me").ExecuteAsync(cancellationToken);
        return profile.HistoryId?.ToString()
            ?? throw new InvalidOperationException("Gmail profile did not return a historyId.");
    }

    public async Task<IReadOnlyList<string>> ListRecentInboxMessageIdsAsync(string accessToken, CancellationToken cancellationToken = default)
    {
        using var service = CreateService(accessToken);
        var request = service.Users.Messages.List("me");
        request.Q = "in:inbox newer_than:1d";
        request.MaxResults = 50;

        var response = await request.ExecuteAsync(cancellationToken);
        return response.Messages?.Select(m => m.Id).ToList() ?? [];
    }

    public async Task<GmailHistoryResult> ListMessageIdsSinceHistoryAsync(string accessToken, string startHistoryId, CancellationToken cancellationToken = default)
    {
        using var service = CreateService(accessToken);

        try
        {
            var messageIds = new List<string>();
            string? pageToken = null;

            do
            {
                var request = service.Users.History.List("me");
                request.StartHistoryId = ulong.Parse(startHistoryId);
                request.HistoryTypes = UsersResource.HistoryResource.ListRequest.HistoryTypesEnum.MessageAdded;
                request.LabelId = "INBOX";
                request.PageToken = pageToken;

                var response = await request.ExecuteAsync(cancellationToken);

                if (response.History is not null)
                {
                    foreach (var record in response.History)
                    {
                        if (record.MessagesAdded is null)
                        {
                            continue;
                        }

                        messageIds.AddRange(record.MessagesAdded
                            .Where(m => m.Message?.Id is not null)
                            .Select(m => m.Message.Id));
                    }
                }

                pageToken = response.NextPageToken;
            } while (!string.IsNullOrEmpty(pageToken));

            return new GmailHistoryResult { HistoryExpired = false, MessageIds = messageIds.Distinct().ToList() };
        }
        catch (GoogleApiException ex) when (ex.HttpStatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return new GmailHistoryResult { HistoryExpired = true, MessageIds = [] };
        }
    }

    public async Task<GmailMessageSummary> GetMessageSummaryAsync(string accessToken, string messageId, CancellationToken cancellationToken = default)
    {
        using var service = CreateService(accessToken);
        var request = service.Users.Messages.Get("me", messageId);
        request.Format = UsersResource.MessagesResource.GetRequest.FormatEnum.Metadata;
        request.MetadataHeaders = new Repeatable<string>(["Subject", "From"]);

        var message = await request.ExecuteAsync(cancellationToken);
        var headers = message.Payload?.Headers;
        var subject = headers?.FirstOrDefault(h => h.Name == "Subject")?.Value;
        var from = headers?.FirstOrDefault(h => h.Name == "From")?.Value;

        return new GmailMessageSummary(message.Id, message.ThreadId, subject, from);
    }

    public async Task<GmailMessageDetail> GetMessageFullAsync(string accessToken, string messageId, CancellationToken cancellationToken = default)
    {
        using var service = CreateService(accessToken);
        var request = service.Users.Messages.Get("me", messageId);
        request.Format = UsersResource.MessagesResource.GetRequest.FormatEnum.Full;

        var message = await request.ExecuteAsync(cancellationToken);
        var headers = message.Payload?.Headers;
        string? Header(string name) => headers?.FirstOrDefault(h => string.Equals(h.Name, name, StringComparison.OrdinalIgnoreCase))?.Value;

        var body = FindPartBody(message.Payload, "text/plain")
            ?? StripHtml(FindPartBody(message.Payload, "text/html"))
            ?? message.Snippet
            ?? string.Empty;

        var receivedAt = message.InternalDate is { } ms
            ? DateTimeOffset.FromUnixTimeMilliseconds(ms).UtcDateTime
            : DateTime.UtcNow;

        return new GmailMessageDetail(
            message.Id,
            message.ThreadId,
            Header("Subject"),
            Header("From"),
            Header("Message-ID"),
            receivedAt,
            message.LabelIds?.Contains("SENT") == true,
            body);
    }

    private static string? FindPartBody(MessagePart? part, string mimeType)
    {
        if (part is null)
        {
            return null;
        }

        if (string.Equals(part.MimeType, mimeType, StringComparison.OrdinalIgnoreCase) && !string.IsNullOrEmpty(part.Body?.Data))
        {
            return DecodeBase64Url(part.Body.Data);
        }

        return part.Parts?.Select(p => FindPartBody(p, mimeType)).FirstOrDefault(b => b is not null);
    }

    private static string DecodeBase64Url(string data)
    {
        var base64 = data.Replace('-', '+').Replace('_', '/');
        base64 = base64.PadRight(base64.Length + (4 - base64.Length % 4) % 4, '=');
        return Encoding.UTF8.GetString(Convert.FromBase64String(base64));
    }

    private static string? StripHtml(string? html)
    {
        if (html is null)
        {
            return null;
        }

        var text = Regex.Replace(html, "<(script|style)[^>]*>.*?</\\1>", " ", RegexOptions.Singleline | RegexOptions.IgnoreCase);
        text = Regex.Replace(text, "<br\\s*/?>|</p>|</div>", "\n", RegexOptions.IgnoreCase);
        text = Regex.Replace(text, "<[^>]+>", " ");
        text = WebUtility.HtmlDecode(text);
        return Regex.Replace(text, "[ \t]+", " ").Trim();
    }

    private static GmailService CreateService(string accessToken)
    {
        return new GmailService(new BaseClientService.Initializer
        {
            HttpClientInitializer = GoogleCredential.FromAccessToken(accessToken),
            ApplicationName = ApplicationName
        });
    }
}
