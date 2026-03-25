using MedicaAI.Core.DTOs.Documents;
using MedicaAI.Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MedicaAI.API.Controllers;

[ApiController]
[Authorize]
public class DocumentsController(IDocumentService svc) : ControllerBase
{
    [HttpPost("api/patients/{patientId:guid}/documents")]
    public async Task<IActionResult> Upload(Guid patientId, [FromBody] UploadDocumentRequest req) =>
        Ok(await svc.UploadAsync(patientId, req));

    [HttpGet("api/patients/{patientId:guid}/documents")]
    public async Task<IActionResult> GetByPatient(Guid patientId) =>
        Ok(await svc.GetByPatientAsync(patientId));

    [HttpGet("api/documents/{id:guid}/download")]
    public async Task<IActionResult> Download(Guid id)
    {
        var result = await svc.DownloadFileAsync(id);
        return File(result.Content, result.ContentType, result.FileName);
    }
}
