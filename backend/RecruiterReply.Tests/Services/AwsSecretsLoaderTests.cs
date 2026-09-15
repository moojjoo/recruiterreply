using Amazon.SecretsManager;
using Amazon.SecretsManager.Model;
using Moq;
using RecruiterReply.Services;

namespace RecruiterReply.Tests.Services;

public class AwsSecretsLoaderTests
{
    [Fact]
    public async Task FetchFlattenedSecretsAsync_FlattensNestedJsonIntoColonDelimitedKeys()
    {
        var client = new Mock<IAmazonSecretsManager>();
        client
            .Setup(c => c.GetSecretValueAsync(It.Is<GetSecretValueRequest>(r => r.SecretId == "my-secret"), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new GetSecretValueResponse
            {
                SecretString = """{"Jwt":{"Key":"abc123"},"OpenAI":{"ApiKey":"sk-xyz"},"TopLevel":"value"}""",
            });

        var result = await AwsSecretsLoader.FetchFlattenedSecretsAsync("my-secret", client.Object);

        Assert.Equal("abc123", result["Jwt:Key"]);
        Assert.Equal("sk-xyz", result["OpenAI:ApiKey"]);
        Assert.Equal("value", result["TopLevel"]);
    }

    [Fact]
    public async Task FetchFlattenedSecretsAsync_WithEmptySecretString_Throws()
    {
        var client = new Mock<IAmazonSecretsManager>();
        client
            .Setup(c => c.GetSecretValueAsync(It.IsAny<GetSecretValueRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new GetSecretValueResponse { SecretString = "" });

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            AwsSecretsLoader.FetchFlattenedSecretsAsync("my-secret", client.Object));
    }

    [Fact]
    public async Task FetchFlattenedSecretsAsync_WhenClientThrows_WrapsInInvalidOperationException()
    {
        var client = new Mock<IAmazonSecretsManager>();
        client
            .Setup(c => c.GetSecretValueAsync(It.IsAny<GetSecretValueRequest>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new AmazonSecretsManagerException("access denied"));

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            AwsSecretsLoader.FetchFlattenedSecretsAsync("my-secret", client.Object));
        Assert.Contains("my-secret", ex.Message);
    }

    [Fact]
    public async Task FetchFlattenedSecretsAsync_WithNonStringValue_PreservesRawJson()
    {
        var client = new Mock<IAmazonSecretsManager>();
        client
            .Setup(c => c.GetSecretValueAsync(It.IsAny<GetSecretValueRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new GetSecretValueResponse { SecretString = """{"Feature":{"Enabled":true}}""" });

        var result = await AwsSecretsLoader.FetchFlattenedSecretsAsync("my-secret", client.Object);

        Assert.Equal("true", result["Feature:Enabled"]);
    }
}
