using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using RecruiterReply.Middleware;

namespace RecruiterReply.Tests.Middleware;

public class ErrorHandlingMiddlewareTests
{
    private static async Task<(int StatusCode, string Body)> InvokeAsync(RequestDelegate next)
    {
        var middleware = new ErrorHandlingMiddleware(next, NullLogger<ErrorHandlingMiddleware>.Instance);
        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();

        await middleware.InvokeAsync(context);

        context.Response.Body.Seek(0, SeekOrigin.Begin);
        var body = await new StreamReader(context.Response.Body).ReadToEndAsync();
        return (context.Response.StatusCode, body);
    }

    [Fact]
    public async Task InvokeAsync_WhenNextSucceeds_LeavesResponseUntouched()
    {
        var (statusCode, body) = await InvokeAsync(ctx =>
        {
            ctx.Response.StatusCode = 201;
            return Task.CompletedTask;
        });

        Assert.Equal(201, statusCode);
        Assert.Empty(body);
    }

    [Fact]
    public async Task InvokeAsync_WhenNextThrowsArgumentException_Returns400WithMessage()
    {
        var (statusCode, body) = await InvokeAsync(_ => throw new ArgumentException("bad input"));

        Assert.Equal(400, statusCode);
        using var json = JsonDocument.Parse(body);
        Assert.Equal("bad input", json.RootElement.GetProperty("error").GetString());
        Assert.Equal(400, json.RootElement.GetProperty("statusCode").GetInt32());
    }

    [Fact]
    public async Task InvokeAsync_WhenNextThrowsUnexpectedException_Returns500WithGenericMessage()
    {
        var (statusCode, body) = await InvokeAsync(_ => throw new InvalidOperationException("secret internal detail"));

        Assert.Equal(500, statusCode);
        using var json = JsonDocument.Parse(body);
        Assert.Equal("An unexpected error occurred.", json.RootElement.GetProperty("error").GetString());
        Assert.DoesNotContain("secret internal detail", body);
    }
}
