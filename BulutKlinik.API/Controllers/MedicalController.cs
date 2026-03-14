using System.Security.Claims;
using BulutKlinik.Core.DTOs.Medical;
using BulutKlinik.Core.Entities;
using BulutKlinik.Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BulutKlinik.API.Controllers;

[ApiController]
[Authorize]
public class MedicalController(IMedicalService medicalService) : ControllerBase
{
    private Guid CurrentUserId =>
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // ── Hasta Geçmişi ─────────────────────────────────────────────

    [HttpPut("api/patients/{patientId:guid}/history")]
    [Authorize(Roles = "Doctor,Staff")]
    public async Task<IActionResult> UpsertHistory(Guid patientId, [FromBody] PatientHistoryRequest request)
    {
        var result = await medicalService.UpsertHistoryAsync(patientId, request);
        return Ok(result);
    }

    [HttpGet("api/patients/{patientId:guid}/history")]
    [Authorize(Roles = "Doctor,Staff,Patient")]
    public async Task<IActionResult> GetHistory(Guid patientId)
    {
        // Hasta sadece kendi geçmişini görebilir
        if (User.IsInRole("Patient") && CurrentUserId != patientId)
            return Forbid();

        var result = await medicalService.GetHistoryAsync(patientId);
        if (result is null) return NotFound(new { mesaj = "Hasta geçmişi bulunamadı." });
        return Ok(result);
    }

    // ── Muayene Kaydı ─────────────────────────────────────────────

    [HttpPost("api/appointments/{appointmentId:guid}/medical-record")]
    [Authorize(Roles = "Doctor")]
    public async Task<IActionResult> CreateMedicalRecord(
        Guid appointmentId, [FromBody] CreateMedicalRecordRequest request)
    {
        var doctorId = CurrentUserId;
        // patientId AppointmentId üzerinden resolve edilir — servis içinde dolduruluyor
        // Basit tutalım: request'ten patientId alıyoruz ya da doctor kendi randevusunu işliyor
        // Plan: appointmentId → patientId otomatik — ancak şimdilik requester doctor, patientId header'dan değil body'den
        // Sprint planı: POST /api/appointments/{id}/medical-record
        // Body'de patientId zorunlu değil, appointmentId'den çözümleyeceğiz
        var result = await medicalService.CreateMedicalRecordAsync(
            Guid.Empty, doctorId, appointmentId, request);
        return StatusCode(201, result);
    }

    [HttpGet("api/patients/{patientId:guid}/medical-records")]
    [Authorize(Roles = "Doctor,Staff,Patient")]
    public async Task<IActionResult> GetMedicalRecords(Guid patientId)
    {
        if (User.IsInRole("Patient") && CurrentUserId != patientId)
            return Forbid();

        var result = await medicalService.GetMedicalRecordsAsync(patientId);
        return Ok(result);
    }

    // ── Ölçümler ──────────────────────────────────────────────────

    [HttpPost("api/patients/{patientId:guid}/measurements")]
    [Authorize(Roles = "Doctor,Staff")]
    public async Task<IActionResult> AddMeasurement(
        Guid patientId, [FromBody] CreateMeasurementRequest request)
    {
        var result = await medicalService.AddMeasurementAsync(patientId, request);
        return StatusCode(201, result);
    }

    [HttpGet("api/patients/{patientId:guid}/measurements")]
    [Authorize(Roles = "Doctor,Staff,Patient")]
    public async Task<IActionResult> GetMeasurements(
        Guid patientId, [FromQuery] MeasurementType? type)
    {
        if (User.IsInRole("Patient") && CurrentUserId != patientId)
            return Forbid();

        var result = await medicalService.GetMeasurementsAsync(patientId, type);
        return Ok(result);
    }
}
