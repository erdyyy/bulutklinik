using System.Security.Claims;
using BulutKlinik.Core.DTOs.Appointment;
using BulutKlinik.Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BulutKlinik.API.Controllers;

[ApiController]
[Route("api/appointments")]
public class AppointmentsController(IAppointmentService appointmentService) : ControllerBase
{
    private Guid CurrentUserId =>
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    /// <summary>Belirtilen doktorun o gündeki müsait slotlarını getirir.</summary>
    [HttpGet("slots")]
    public async Task<IActionResult> GetSlots([FromQuery] Guid doctorId, [FromQuery] DateOnly date)
    {
        var result = await appointmentService.GetAvailableSlotsAsync(doctorId, date);
        return Ok(result);
    }

    /// <summary>Yeni randevu oluşturur. Yalnızca Patient rolü.</summary>
    [HttpPost]
    [Authorize(Roles = "Patient")]
    [ProducesResponseType(typeof(AppointmentResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create(CreateAppointmentRequest req)
    {
        var result = await appointmentService.CreateAsync(CurrentUserId, req);
        return Created($"/api/appointments/{result.Id}", result);
    }

    /// <summary>Doktorun randevularını getirir. Opsiyonel tarih filtresi.</summary>
    [HttpGet("doctor/{doctorId:guid}")]
    [Authorize(Roles = "Doctor,Staff")]
    public async Task<IActionResult> GetByDoctor(Guid doctorId, [FromQuery] DateOnly? date)
    {
        var result = await appointmentService.GetByDoctorAsync(doctorId, date);
        return Ok(result);
    }

    /// <summary>Giriş yapan hastanın randevularını getirir.</summary>
    [HttpGet("my")]
    [Authorize(Roles = "Patient")]
    public async Task<IActionResult> GetMyAppointments()
    {
        var result = await appointmentService.GetByPatientAsync(CurrentUserId);
        return Ok(result);
    }

    /// <summary>Randevu durumunu günceller (Confirmed, Cancelled, Completed, NoShow).</summary>
    [HttpPatch("{id:guid}/status")]
    [Authorize]
    [ProducesResponseType(typeof(AppointmentResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> UpdateStatus(Guid id, UpdateStatusRequest req)
    {
        var result = await appointmentService.UpdateStatusAsync(id, CurrentUserId, req);
        return Ok(result);
    }
}
