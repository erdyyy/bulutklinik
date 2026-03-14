using BulutKlinik.Core.DTOs.Medical;
using BulutKlinik.Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BulutKlinik.API.Controllers;

[ApiController]
[Authorize]
public class MedicalController(IMedicalService svc) : ControllerBase
{
    [HttpGet("api/patients/{patientId:guid}/history")]
    public async Task<IActionResult> GetHistory(Guid patientId) =>
        Ok(await svc.GetHistoryAsync(patientId));

    [HttpPut("api/patients/{patientId:guid}/history")]
    public async Task<IActionResult> UpsertHistory(Guid patientId, UpsertHistoryRequest req) =>
        Ok(await svc.UpsertHistoryAsync(patientId, req));

    [HttpPost("api/appointments/{appointmentId:guid}/medical-record")]
    [Authorize(Roles = "Doctor")]
    public async Task<IActionResult> CreateRecord(Guid appointmentId, CreateMedicalRecordRequest req) =>
        Ok(await svc.CreateRecordAsync(appointmentId, req));

    [HttpGet("api/patients/{patientId:guid}/medical-records")]
    public async Task<IActionResult> GetRecords(Guid patientId) =>
        Ok(await svc.GetRecordsAsync(patientId));

    [HttpPost("api/patients/{patientId:guid}/measurements")]
    public async Task<IActionResult> CreateMeasurement(Guid patientId, CreateMeasurementRequest req) =>
        Ok(await svc.CreateMeasurementAsync(patientId, req));

    [HttpGet("api/patients/{patientId:guid}/measurements")]
    public async Task<IActionResult> GetMeasurements(Guid patientId, [FromQuery] string? type) =>
        Ok(await svc.GetMeasurementsAsync(patientId, type));
}
