using System.Net;
using Microsoft.Extensions.Logging.Abstractions;
using RecruiterReply.Services;
using RecruiterReply.Tests.Testing;

namespace RecruiterReply.Tests.Services;

public class OpenAIServiceTests
{
    private const string ConfiguredKey = "sk-proj-real-test-key";

    private static HttpResponseMessage JsonResponse(HttpStatusCode status, string json) =>
        new(status) { Content = new StringContent(json, System.Text.Encoding.UTF8, "application/json") };

    private static OpenAIService CreateSut(Func<HttpRequestMessage, HttpResponseMessage> responder, string apiKey = ConfiguredKey) =>
        new(apiKey, NullLogger<OpenAIService>.Instance, new FakeHttpMessageHandler(responder));

    [Fact]
    public void Constructor_WithEmptyApiKey_Throws()
    {
        Assert.Throws<ArgumentException>(() => new OpenAIService("", NullLogger<OpenAIService>.Instance));
    }

    [Theory]
    [InlineData("sk-proj-NOT_CONFIGURED")]
    [InlineData("sk-proj-YOUR_KEY_HERE")]
    public async Task AnalyzeRecruiterMessageAsync_WithPlaceholderKey_ThrowsWithoutCallingNetwork(string placeholderKey)
    {
        var called = false;
        var sut = CreateSut(_ => { called = true; return JsonResponse(HttpStatusCode.OK, "{}"); }, placeholderKey);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => sut.AnalyzeRecruiterMessageAsync("hi", null, null));

        Assert.Contains("not configured", ex.Message);
        Assert.False(called);
    }

    [Fact]
    public async Task AnalyzeRecruiterMessageAsync_WithEmptyMessage_Throws()
    {
        var sut = CreateSut(_ => JsonResponse(HttpStatusCode.OK, "{}"));

        await Assert.ThrowsAsync<ArgumentException>(() => sut.AnalyzeRecruiterMessageAsync("", null, null));
    }

    [Fact]
    public async Task CallOpenAI_OnUnauthorized_ThrowsAuthFailedMessage()
    {
        var sut = CreateSut(_ => JsonResponse(HttpStatusCode.Unauthorized, "{}"));

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => sut.AnalyzeRecruiterMessageAsync("hi", null, null));

        Assert.Contains("authentication failed", ex.Message);
    }

    [Fact]
    public async Task CallOpenAI_OnTooManyRequests_ThrowsRateLimitMessage()
    {
        var sut = CreateSut(_ => JsonResponse(HttpStatusCode.TooManyRequests, "{}"));

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => sut.AnalyzeRecruiterMessageAsync("hi", null, null));

        Assert.Contains("rate limit or quota exceeded", ex.Message);
    }

    [Fact]
    public async Task CallOpenAI_OnBadRequestMentioningModel_ThrowsModelUnavailableMessage()
    {
        var sut = CreateSut(_ => JsonResponse(HttpStatusCode.BadRequest, "{\"error\":\"the model 'gpt-4-turbo' does not exist\"}"));

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => sut.AnalyzeRecruiterMessageAsync("hi", null, null));

        Assert.Contains("model", ex.Message);
        Assert.Contains("unavailable", ex.Message);
    }

    [Fact]
    public async Task CallOpenAI_OnOtherFailure_ThrowsGenericMessage()
    {
        var sut = CreateSut(_ => JsonResponse(HttpStatusCode.InternalServerError, "{}"));

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => sut.AnalyzeRecruiterMessageAsync("hi", null, null));

        Assert.Contains("billing status", ex.Message);
    }

    [Fact]
    public async Task CallOpenAI_WithEmptyChoices_ThrowsEmptyResponseMessage()
    {
        var sut = CreateSut(_ => JsonResponse(HttpStatusCode.OK, """{"choices":[]}"""));

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => sut.AnalyzeRecruiterMessageAsync("hi", null, null));

        Assert.Contains("empty response", ex.Message);
    }

    [Fact]
    public async Task AnalyzeRecruiterMessageAsync_OnSuccess_ReturnsMessageContent()
    {
        var sut = CreateSut(_ => JsonResponse(HttpStatusCode.OK, """
            {"choices":[{"message":{"role":"assistant","content":"{\"opportunityScore\":90}"}}]}
            """));

        var result = await sut.AnalyzeRecruiterMessageAsync("hi", "Acme", "Engineer");

        Assert.Equal("{\"opportunityScore\":90}", result);
    }

    [Fact]
    public async Task GenerateReplyAsync_WithEmptyReplyType_Throws()
    {
        var sut = CreateSut(_ => JsonResponse(HttpStatusCode.OK, "{}"));

        await Assert.ThrowsAsync<ArgumentException>(() => sut.GenerateReplyAsync("", "hi", null, null, null));
    }

    [Fact]
    public async Task CompareOffersAsync_WithMissingOfferJson_Throws()
    {
        var sut = CreateSut(_ => JsonResponse(HttpStatusCode.OK, "{}"));

        await Assert.ThrowsAsync<ArgumentException>(() => sut.CompareOffersAsync("", "{}"));
    }
}
