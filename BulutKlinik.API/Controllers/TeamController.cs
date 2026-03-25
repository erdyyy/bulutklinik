using BulutKlinik.Core.DTOs.Team;
using BulutKlinik.Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BulutKlinik.API.Controllers;

[ApiController]
[Route("api/team")]
[Authorize(Roles = "Doctor")]
public class TeamController(ITeamService svc) : ControllerBase
{
    [HttpGet("{doctorId:guid}")]
    public async Task<IActionResult> GetByDoctor(Guid doctorId) =>
        Ok(await svc.GetByDoctorAsync(doctorId));

    [HttpPost]
    public async Task<IActionResult> Create(CreateTeamMemberRequest req)
    {
        var result = await svc.CreateAsync(req);
        return Created($"/api/team/{result.Id}", result);
    }

    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, UpdateTeamMemberRequest req) =>
        Ok(await svc.UpdateAsync(id, req));

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        await svc.DeleteAsync(id);
        return NoContent();
    }
}
