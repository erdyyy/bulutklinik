using BulutKlinik.Core.DTOs.Notification;
using BulutKlinik.Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BulutKlinik.API.Controllers;

[ApiController]
[Authorize(Roles = "Doctor,Staff")]
public class NotificationController(INotificationService notificationService) : ControllerBase
{
    [HttpPost("api/notifications/send")]
    public async Task<IActionResult> Send([FromBody] SendNotificationRequest request)
    {
        var result = await notificationService.SendAsync(request);
        return StatusCode(201, result);
    }

    [HttpGet("api/notifications")]
    public async Task<IActionResult> GetLogs([FromQuery] Guid? patientId)
    {
        var result = await notificationService.GetLogsAsync(patientId);
        return Ok(result);
    }
}
