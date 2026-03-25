using System.Net;
using System.Text.Json;

namespace MedicaAI.API.Middleware;

public class GlobalExceptionMiddleware(RequestDelegate next, ILogger<GlobalExceptionMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "İşlenmeyen hata: {Message}", ex.Message);
            await HandleExceptionAsync(context, ex);
        }
    }

    private static Task HandleExceptionAsync(HttpContext context, Exception ex)
    {
        var (statusCode, message) = ex switch
        {
            ArgumentException             => (HttpStatusCode.BadRequest, ex.Message),
            InvalidOperationException     => (HttpStatusCode.Conflict, ex.Message),
            KeyNotFoundException          => (HttpStatusCode.NotFound, ex.Message),
            UnauthorizedAccessException   => (HttpStatusCode.Unauthorized, ex.Message),
            _                             => (HttpStatusCode.InternalServerError, "Beklenmeyen bir hata oluştu.")
        };

        context.Response.ContentType = "application/json";
        context.Response.StatusCode  = (int)statusCode;

        var body = JsonSerializer.Serialize(new
        {
            status  = (int)statusCode,
            message,
            timestamp = DateTime.UtcNow
        });

        return context.Response.WriteAsync(body);
    }
}
