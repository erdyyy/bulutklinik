using BulutKlinik.Core.DTOs.Stock;
using BulutKlinik.Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BulutKlinik.API.Controllers;

[ApiController]
[Authorize(Roles = "Doctor,Staff")]
public class StockController(IStockService stockService) : ControllerBase
{
    [HttpPost("api/patients/{patientId:guid}/documents")]
    public async Task<IActionResult> UploadDocument(Guid patientId, [FromBody] CreateDocumentRequest request)
    {
        var result = await stockService.UploadDocumentAsync(patientId, request);
        return StatusCode(201, result);
    }

    [HttpGet("api/patients/{patientId:guid}/documents")]
    public async Task<IActionResult> GetDocuments(Guid patientId)
    {
        var result = await stockService.GetDocumentsAsync(patientId);
        return Ok(result);
    }

    [HttpGet("api/documents/{id:guid}/download")]
    public async Task<IActionResult> DownloadDocument(Guid id)
    {
        var result = await stockService.DownloadDocumentAsync(id);
        return Ok(result);
    }

    [HttpGet("api/stock")]
    public async Task<IActionResult> GetStock()
    {
        var result = await stockService.GetStockAsync();
        return Ok(result);
    }

    [HttpPost("api/stock")]
    public async Task<IActionResult> CreateStockItem([FromBody] StockItemRequest request)
    {
        var result = await stockService.CreateStockItemAsync(request);
        return StatusCode(201, result);
    }

    [HttpPost("api/stock/{id:guid}/movement")]
    public async Task<IActionResult> AddMovement(Guid id, [FromBody] StockMovementRequest request)
    {
        var result = await stockService.AddMovementAsync(id, request);
        return StatusCode(201, result);
    }

    [HttpGet("api/stock/low")]
    public async Task<IActionResult> GetLowStock()
    {
        var result = await stockService.GetLowStockAsync();
        return Ok(result);
    }
}
