using BulutKlinik.Core.DTOs.Consent;
using BulutKlinik.Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BulutKlinik.API.Controllers;

[ApiController]
[Route("api/consents")]
[Authorize]
public class ConsentController(IConsentService svc) : ControllerBase
{
    [HttpGet("doctor/{doctorId:guid}")]
    [Authorize(Roles = "Doctor,Staff")]
    public async Task<IActionResult> GetByDoctor(Guid doctorId) =>
        Ok(await svc.GetByDoctorAsync(doctorId));

    [HttpGet("patient/{patientId:guid}")]
    public async Task<IActionResult> GetByPatient(Guid patientId) =>
        Ok(await svc.GetByPatientAsync(patientId));

    [HttpPost]
    [Authorize(Roles = "Doctor,Staff")]
    public async Task<IActionResult> Create(CreateConsentRequest req)
    {
        var result = await svc.CreateAsync(req);
        return Created($"/api/consents/{result.Id}", result);
    }
}
