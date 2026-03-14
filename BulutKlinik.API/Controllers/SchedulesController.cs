using System.Security.Claims;
using BulutKlinik.Core.DTOs.Schedule;
using BulutKlinik.Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BulutKlinik.API.Controllers;

[ApiController]
[Route("api/doctors/{doctorId:guid}/schedules")]
public class SchedulesController(IScheduleService scheduleService) : ControllerBase
{
    /// <summary>Doktorun aktif çalışma takvimini getirir.</summary>
    [HttpGet]
    public async Task<IActionResult> GetSchedules(Guid doctorId)
    {
        var result = await scheduleService.GetSchedulesAsync(doctorId);
        return Ok(result);
    }

    /// <summary>Çalışma günü ekler veya günceller (upsert).</summary>
    [HttpPut]
    [Authorize(Roles = "Doctor")]
    public async Task<IActionResult> UpsertSchedule(Guid doctorId, WorkingScheduleRequest req)
    {
        if (!IsOwner(doctorId)) return Forbid();
        var result = await scheduleService.UpsertScheduleAsync(doctorId, req);
        return Ok(result);
    }

    /// <summary>Çalışma gününü pasif yapar (soft delete).</summary>
    [HttpDelete("{scheduleId:guid}")]
    [Authorize(Roles = "Doctor")]
    public async Task<IActionResult> DeleteSchedule(Guid doctorId, Guid scheduleId)
    {
        if (!IsOwner(doctorId)) return Forbid();
        await scheduleService.DeleteScheduleAsync(doctorId, scheduleId);
        return NoContent();
    }

    // ── Leaves ───────────────────────────────────────────────────

    /// <summary>Doktorun gelecekteki izin günlerini getirir.</summary>
    [HttpGet("leaves")]
    public async Task<IActionResult> GetLeaves(Guid doctorId)
    {
        var result = await scheduleService.GetLeavesAsync(doctorId);
        return Ok(result);
    }

    /// <summary>İzin günü ekler.</summary>
    [HttpPost("leaves")]
    [Authorize(Roles = "Doctor")]
    public async Task<IActionResult> AddLeave(Guid doctorId, DoctorLeaveRequest req)
    {
        if (!IsOwner(doctorId)) return Forbid();
        var result = await scheduleService.AddLeaveAsync(doctorId, req);
        return Created(string.Empty, result);
    }

    /// <summary>İzin günü siler.</summary>
    [HttpDelete("leaves/{leaveId:guid}")]
    [Authorize(Roles = "Doctor")]
    public async Task<IActionResult> DeleteLeave(Guid doctorId, Guid leaveId)
    {
        if (!IsOwner(doctorId)) return Forbid();
        await scheduleService.DeleteLeaveAsync(doctorId, leaveId);
        return NoContent();
    }

    // ── Helper ───────────────────────────────────────────────────
    private bool IsOwner(Guid doctorId)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return userId == doctorId.ToString();
    }
}
