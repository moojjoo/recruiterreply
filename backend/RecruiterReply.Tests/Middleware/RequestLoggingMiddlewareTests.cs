using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using RecruiterReply.Middleware;

namespace RecruiterReply.Tests.Middleware;

public class RequestLoggingMiddlewareTests
{
    [Fact]
    public async Task InvokeAsync_CallsNextAndLeavesResponseUntouched()
    {
        var nextCalled = false;
        var middleware = new RequestLoggingMiddleware(
            ctx =>
            {
                nextCalled = true;
                ctx.Response.StatusCode = 204;
                return Task.CompletedTask;
            },
            NullLogger<RequestLoggingMiddleware>.Instance);
        var context = new DefaultHttpContext();

        await middleware.InvokeAsync(context);

        Assert.True(nextCalled);
        Assert.Equal(204, context.Response.StatusCode);
    }

    [Fact]
    public async Task InvokeAsync_WhenNextThrows_PropagatesException()
    {
        var middleware = new RequestLoggingMiddleware(_ => throw new InvalidOperationException("boom"), NullLogger<RequestLoggingMiddleware>.Instance);
        var context = new DefaultHttpContext();

        await Assert.ThrowsAsync<InvalidOperationException>(() => middleware.InvokeAsync(context));
    }
}
