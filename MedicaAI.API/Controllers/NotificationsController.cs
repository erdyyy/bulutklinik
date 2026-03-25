using MedicaAI.Core.DTOs.Notification;
using MedicaAI.Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MedicaAI.API.Controllers;

[ApiController]
[Route("api/notifications")]
[Authorize(Roles = "Doctor,Staff")]
public class NotificationsController(INotificationService svc) : ControllerBase
{
    [HttpPost("send")]
    public async Task<IActionResult> Send(SendNotificationRequest req) =>
        Ok(await svc.SendAsync(req));

    [HttpGet]
    public async Task<IActionResult> GetByPatient([FromQuery] Guid patientId) =>
        Ok(await svc.GetByPatientAsync(patientId));
}
