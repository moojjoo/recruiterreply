namespace RecruiterReply.Tests.Testing;

/// <summary>
/// Stands in for the network when a service is given an injected HttpMessageHandler
/// (OpenAIService, GoogleAuthService via IHttpClientFactory). The responder inspects the
/// outgoing request and returns whatever canned response the test wants.
/// </summary>
public class FakeHttpMessageHandler : HttpMessageHandler
{
    private readonly Func<HttpRequestMessage, HttpResponseMessage> _responder;

    public FakeHttpMessageHandler(Func<HttpRequestMessage, HttpResponseMessage> responder)
    {
        _responder = responder;
    }

    public List<HttpRequestMessage> Requests { get; } = [];

    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        Requests.Add(request);
        return Task.FromResult(_responder(request));
    }
}
