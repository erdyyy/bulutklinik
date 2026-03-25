using BulutKlinik.Core.DTOs.Packages;
using BulutKlinik.Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BulutKlinik.API.Controllers;

[ApiController]
[Route("api/packages")]
[Authorize]
public class PackagesController(IPackageService svc) : ControllerBase
{
    [HttpGet("doctor/{doctorId:guid}")]
    [Authorize(Roles = "Doctor,Staff")]
    public async Task<IActionResult> GetByDoctor(Guid doctorId) =>
        Ok(await svc.GetByDoctorAsync(doctorId));

    [HttpGet("patient/{patientId:guid}")]
    public async Task<IActionResult> GetByPatient(Guid patientId) =>
        Ok(await svc.GetByPatientAsync(patientId));

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id) =>
        Ok(await svc.GetAsync(id));

    [HttpPost]
    [Authorize(Roles = "Doctor,Staff")]
    public async Task<IActionResult> Create(CreatePackageRequest req)
    {
        var result = await svc.CreateAsync(req);
        return Created($"/api/packages/{result.Id}", result);
    }

    [HttpPost("{id:guid}/complete-session")]
    [Authorize(Roles = "Doctor,Staff")]
    public async Task<IActionResult> CompleteSession(Guid id, CompleteSessionRequest req) =>
        Ok(await svc.CompleteSessionAsync(id, req));

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Doctor,Staff")]
    public async Task<IActionResult> Delete(Guid id)
    {
        await svc.DeleteAsync(id);
        return NoContent();
    }
}
