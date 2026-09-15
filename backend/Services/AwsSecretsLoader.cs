using System.Text.Json;
using Amazon.SecretsManager;
using Amazon.SecretsManager.Model;

namespace RecruiterReply.Services;

/// <summary>
/// Loads a JSON secret from AWS Secrets Manager and flattens it into ASP.NET Core
/// colon-delimited config keys (mirroring appsettings.json's nested shape), so a secret
/// like {"Jwt":{"Key":"..."}} becomes the config key "Jwt:Key". Uses the default AWS
/// credential/region chain — on EC2 this resolves via the instance's IAM role automatically,
/// no explicit credentials needed.
/// </summary>
public static class AwsSecretsLoader
{
    public static async Task<Dictionary<string, string?>> FetchFlattenedSecretsAsync(string secretName, IAmazonSecretsManager? client = null, CancellationToken cancellationToken = default)
    {
        var ownsClient = client is null;
        client ??= new AmazonSecretsManagerClient();

        try
        {
            GetSecretValueResponse response;
            try
            {
                response = await client.GetSecretValueAsync(new GetSecretValueRequest { SecretId = secretName }, cancellationToken);
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException(
                    $"Failed to fetch secret '{secretName}' from AWS Secrets Manager. " +
                    "Verify the secret exists and the instance's IAM role has secretsmanager:GetSecretValue on it.", ex);
            }

            if (string.IsNullOrWhiteSpace(response.SecretString))
            {
                throw new InvalidOperationException($"Secret '{secretName}' has no SecretString value.");
            }

            using var document = JsonDocument.Parse(response.SecretString);
            var flattened = new Dictionary<string, string?>();
            Flatten(document.RootElement, prefix: null, flattened);
            return flattened;
        }
        finally
        {
            if (ownsClient)
            {
                client.Dispose();
            }
        }
    }

    private static void Flatten(JsonElement element, string? prefix, IDictionary<string, string?> target)
    {
        foreach (var property in element.EnumerateObject())
        {
            var key = string.IsNullOrEmpty(prefix) ? property.Name : $"{prefix}:{property.Name}";

            if (property.Value.ValueKind == JsonValueKind.Object)
            {
                Flatten(property.Value, key, target);
            }
            else
            {
                target[key] = property.Value.ValueKind == JsonValueKind.String
                    ? property.Value.GetString()
                    : property.Value.GetRawText();
            }
        }
    }
}
