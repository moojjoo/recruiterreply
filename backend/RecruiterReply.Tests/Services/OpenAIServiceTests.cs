using System.Net;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using RecruiterReply.Services;
using RecruiterReply.Tests.Testing;

namespace RecruiterReply.Tests.Services;

public class OpenAIServiceTests
{
    private const string ConfiguredKey = "sk-proj-real-test-key";

    private static HttpResponseMessage JsonResponse(HttpStatusCode status, string json) =>
        new(status) { Content = new StringContent(json, System.Text.Encoding.UTF8, "application/json") };

    private static OpenAIService CreateSut(
        Func<HttpRequestMessage, HttpResponseMessage> responder,
        string apiKey = ConfiguredKey,
        ILogger<OpenAIService>? logger = null,
        string? model = null) =>
        new(apiKey, logger ?? NullLogger<OpenAIService>.Instance, new FakeHttpMessageHandler(responder), model);

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

        Assert.Contains("authentication is unavailable", ex.Message);
    }

    [Fact]
    public async Task CallOpenAI_OnTooManyRequests_ThrowsRateLimitMessage()
    {
        var sut = CreateSut(_ => JsonResponse(HttpStatusCode.TooManyRequests, "{}"));

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => sut.AnalyzeRecruiterMessageAsync("hi", null, null));

        Assert.Contains("temporarily unavailable", ex.Message);
    }

    [Fact]
    public async Task CallOpenAI_OnBadRequestMentioningModel_ThrowsModelUnavailableMessage()
    {
        var sut = CreateSut(_ => JsonResponse(HttpStatusCode.BadRequest,
            "{\"error\":{\"message\":\"the model does not exist\",\"type\":\"invalid_request_error\",\"code\":\"model_not_found\"}}"));

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => sut.AnalyzeRecruiterMessageAsync("hi", null, null));

        Assert.Contains("model", ex.Message);
        Assert.Contains("unavailable", ex.Message);
    }

    [Fact]
    public async Task CallOpenAI_OnNotFoundModel_ThrowsModelUnavailableMessage()
    {
        var sut = CreateSut(_ => JsonResponse(HttpStatusCode.NotFound,
            "{\"error\":{\"message\":\"missing\",\"code\":\"model_not_found\"}}"));

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => sut.GenerateReplyAsync("interested", "hi", null, null, null));

        Assert.Contains("model is unavailable", ex.Message);
    }

    [Fact]
    public async Task CallOpenAI_OnOtherFailure_ThrowsGenericMessage()
    {
        var sut = CreateSut(_ => JsonResponse(HttpStatusCode.InternalServerError, "{}"));

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => sut.AnalyzeRecruiterMessageAsync("hi", null, null));

        Assert.Equal("The AI service could not complete this request. Please try again later.", ex.Message);
    }

    [Fact]
    public async Task CallOpenAI_OnFailure_LogsMetadataWithoutProviderBody()
    {
        const string sensitiveBody = "{\"error\":{\"message\":\"secret provider detail\",\"code\":\"server_error\"}}";
        var logger = new CapturingLogger<OpenAIService>();
        var response = JsonResponse(HttpStatusCode.InternalServerError, sensitiveBody);
        response.Headers.Add("x-request-id", "req-safe-id");
        var sut = CreateSut(_ => response, logger: logger);

        await Assert.ThrowsAsync<InvalidOperationException>(() => sut.AnalyzeRecruiterMessageAsync("hi", null, null));

        var log = Assert.Single(logger.Messages, message => message.Contains("OpenAI request failed"));
        Assert.Contains("server_error", log);
        Assert.Contains("req-safe-id", log);
        Assert.DoesNotContain("secret provider detail", log);
        Assert.DoesNotContain(sensitiveBody, log);
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
    public async Task Request_UsesCurrentDefaultModelAndCompletionTokenField()
    {
        string? requestBody = null;
        var sut = CreateSut(request =>
        {
            requestBody = request.Content!.ReadAsStringAsync().GetAwaiter().GetResult();
            return JsonResponse(HttpStatusCode.OK, "{\"choices\":[{\"message\":{\"content\":\"ok\"}}]}");
        });

        await sut.GenerateReplyAsync("interested", "hi", null, null, null);

        using var document = JsonDocument.Parse(requestBody!);
        Assert.Equal("gpt-4.1-mini", document.RootElement.GetProperty("model").GetString());
        Assert.Equal(2000, document.RootElement.GetProperty("max_completion_tokens").GetInt32());
        Assert.False(document.RootElement.TryGetProperty("max_tokens", out _));
    }

    [Fact]
    public async Task AllOpenAIBackedOperations_UseSharedSuccessfulTransport()
    {
        var calls = 0;
        var sut = CreateSut(_ =>
        {
            calls++;
            var content = calls == 4
                ? "{\"isRecruiter\":true,\"skills\":[]}"
                : "ok";
            return JsonResponse(HttpStatusCode.OK,
                JsonSerializer.Serialize(new { choices = new[] { new { message = new { content } } } }));
        });

        Assert.Equal("ok", await sut.AnalyzeRecruiterMessageAsync("message", null, null));
        Assert.Equal("ok", await sut.GenerateReplyAsync("interested", "message", null, null, null));
        Assert.Equal("ok", await sut.CompareOffersAsync("{}", "{}"));
        Assert.True((await sut.ExtractRecruiterFactsAsync("subject", "from", "body")).IsRecruiter);
        Assert.Equal("ok", await sut.GenerateTriageReplyAsync(
            new TriageReplyContext(TriageStates.Qualified, [], [], null, "Jane", "Role", "body")));
        Assert.Equal(5, calls);
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

internal sealed class CapturingLogger<T> : ILogger<T>
{
    public List<string> Messages { get; } = [];

    public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
    public bool IsEnabled(LogLevel logLevel) => true;
    public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception,
        Func<TState, Exception?, string> formatter) => Messages.Add(formatter(state, exception));
}

public class OpenAIServiceParseRecruiterFactsTests
{
    [Fact]
    public void ParseRecruiterFacts_HandlesMarkdownFencesAndNulls()
    {
        const string response = """
            ```json
            {"isRecruiter": true, "title": "Data Engineer", "employmentType": "w2", "rateMin": "80", "rateMax": 90,
             "rateUnit": "hour", "workMode": null, "durationMonths": 12, "skills": ["Spark"]}
            ```
            """;

        var facts = OpenAIService.ParseRecruiterFacts(response);

        Assert.True(facts.IsRecruiter);
        Assert.Equal("Data Engineer", facts.Title);
        Assert.Equal(80, facts.RateMin);
        Assert.Equal(90, facts.RateMax);
        Assert.Null(facts.WorkMode);
        Assert.Equal(["Spark"], facts.Skills);
    }

    [Fact]
    public void ParseRecruiterFacts_WithoutJson_Throws()
    {
        Assert.Throws<InvalidOperationException>(() => OpenAIService.ParseRecruiterFacts("I can't help with that."));
    }
}
