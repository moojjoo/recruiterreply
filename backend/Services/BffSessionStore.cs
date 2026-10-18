using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.Model;
using Amazon.KeyManagementService;
using Amazon.KeyManagementService.Model;
using Microsoft.Extensions.Options;
using RecruiterReply.Models;

namespace RecruiterReply.Services;

public sealed record BffSession(
    Guid UserId,
    string ProviderSubject,
    string Issuer,
    string ClientId,
    string Scopes,
    DateTimeOffset CreatedAt,
    DateTimeOffset LastSeenAt,
    DateTimeOffset IdleExpiresAt,
    DateTimeOffset AbsoluteExpiresAt,
    string AccessToken,
    string? RefreshToken);

public interface IBffSessionStore
{
    Task<string> CreateAsync(BffSession session, CancellationToken cancellationToken = default);
    Task<BffSession?> GetAsync(string sessionId, CancellationToken cancellationToken = default);
    Task RevokeAsync(string sessionId, CancellationToken cancellationToken = default);
}

public sealed class DynamoDbBffSessionStore : IBffSessionStore
{
    private const string SessionKeyAttribute = "session_id_hash";
    private const string PayloadAttribute = "encrypted_payload";
    private const string ExpiresAttribute = "expires_at";
    private readonly IAmazonDynamoDB _dynamoDb;
    private readonly IAmazonKeyManagementService _kms;
    private readonly CognitoBffOptions _options;

    public DynamoDbBffSessionStore(IAmazonDynamoDB dynamoDb, IAmazonKeyManagementService kms,
        IOptions<CognitoBffOptions> options)
    {
        _dynamoDb = dynamoDb;
        _kms = kms;
        _options = options.Value;
    }

    public async Task<string> CreateAsync(BffSession session, CancellationToken cancellationToken = default)
    {
        EnsureConfigured();
        var sessionId = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');
        var encrypted = await EncryptAsync(session, cancellationToken);
        var item = new Dictionary<string, AttributeValue>
        {
            [SessionKeyAttribute] = new() { S = Hash(sessionId) },
            [PayloadAttribute] = new() { B = new MemoryStream(encrypted) },
            [ExpiresAttribute] = new() { N = session.AbsoluteExpiresAt.ToUnixTimeSeconds().ToString() }
        };
        await _dynamoDb.PutItemAsync(new PutItemRequest { TableName = _options.SessionTableName, Item = item }, cancellationToken);
        return sessionId;
    }

    public async Task<BffSession?> GetAsync(string sessionId, CancellationToken cancellationToken = default)
    {
        EnsureConfigured();
        var result = await _dynamoDb.GetItemAsync(new GetItemRequest
        {
            TableName = _options.SessionTableName,
            ConsistentRead = true,
            Key = new Dictionary<string, AttributeValue> { [SessionKeyAttribute] = new() { S = Hash(sessionId) } }
        }, cancellationToken);
        if (result.Item.Count == 0 || !result.Item.TryGetValue(PayloadAttribute, out var payload)) return null;
        if (payload.B is null) return null;
        using var stream = payload.B;
        return await DecryptAsync(stream.ToArray(), cancellationToken);
    }

    public Task RevokeAsync(string sessionId, CancellationToken cancellationToken = default)
    {
        EnsureConfigured();
        return _dynamoDb.DeleteItemAsync(new DeleteItemRequest
        {
            TableName = _options.SessionTableName,
            Key = new Dictionary<string, AttributeValue> { [SessionKeyAttribute] = new() { S = Hash(sessionId) } }
        }, cancellationToken);
    }

    private async Task<byte[]> EncryptAsync(BffSession session, CancellationToken cancellationToken)
    {
        var dataKey = await _kms.GenerateDataKeyAsync(new GenerateDataKeyRequest
        {
            KeyId = _options.SessionKmsKeyId,
            KeySpec = DataKeySpec.AES_256,
            EncryptionContext = new Dictionary<string, string> { ["purpose"] = "recruiterreply-bff-session" }
        }, cancellationToken);
        var nonce = RandomNumberGenerator.GetBytes(12);
        var plaintext = JsonSerializer.SerializeToUtf8Bytes(session);
        var ciphertext = new byte[plaintext.Length];
        var tag = new byte[16];
        using (var aes = new AesGcm(dataKey.Plaintext.ToArray(), 16))
        {
            aes.Encrypt(nonce, plaintext, ciphertext, tag, Encoding.UTF8.GetBytes("bff-session-v1"));
        }
        return JsonSerializer.SerializeToUtf8Bytes(new Envelope(
            Convert.ToBase64String(dataKey.CiphertextBlob.ToArray()),
            Convert.ToBase64String(nonce), Convert.ToBase64String(ciphertext), Convert.ToBase64String(tag)));
    }

    private async Task<BffSession> DecryptAsync(byte[] envelopeBytes, CancellationToken cancellationToken)
    {
        var envelope = JsonSerializer.Deserialize<Envelope>(envelopeBytes)
            ?? throw new CryptographicException("Invalid BFF session envelope.");
        var dataKey = await _kms.DecryptAsync(new DecryptRequest
        {
            CiphertextBlob = new MemoryStream(Convert.FromBase64String(envelope.EncryptedDataKey)),
            EncryptionContext = new Dictionary<string, string> { ["purpose"] = "recruiterreply-bff-session" }
        }, cancellationToken);
        var plaintext = new byte[Convert.FromBase64String(envelope.Ciphertext).Length];
        using (var aes = new AesGcm(dataKey.Plaintext.ToArray(), 16))
        {
            aes.Decrypt(Convert.FromBase64String(envelope.Nonce), Convert.FromBase64String(envelope.Ciphertext),
                Convert.FromBase64String(envelope.Tag), plaintext, Encoding.UTF8.GetBytes("bff-session-v1"));
        }
        return JsonSerializer.Deserialize<BffSession>(plaintext)
            ?? throw new CryptographicException("Invalid BFF session payload.");
    }

    private void EnsureConfigured()
    {
        if (string.IsNullOrWhiteSpace(_options.SessionTableName) || string.IsNullOrWhiteSpace(_options.SessionKmsKeyId))
            throw new InvalidOperationException("CognitoBff session storage is not configured.");
    }

    private static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
    private sealed record Envelope(string EncryptedDataKey, string Nonce, string Ciphertext, string Tag);
}
