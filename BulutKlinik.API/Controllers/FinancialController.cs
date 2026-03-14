using BulutKlinik.Core.DTOs.Financial;
using BulutKlinik.Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BulutKlinik.API.Controllers;

[ApiController]
[Authorize(Roles = "Doctor,Staff")]
public class FinancialController(IFinancialService financialService) : ControllerBase
{
    // ── Hizmetler ─────────────────────────────────────────────────

    [HttpGet("api/services")]
    [AllowAnonymous]
    public async Task<IActionResult> GetServices()
    {
        var result = await financialService.GetServicesAsync();
        return Ok(result);
    }

    [HttpPost("api/services")]
    public async Task<IActionResult> CreateService([FromBody] ServiceRequest request)
    {
        var result = await financialService.CreateServiceAsync(request);
        return StatusCode(201, result);
    }

    // ── Faturalar ─────────────────────────────────────────────────

    [HttpPost("api/invoices")]
    public async Task<IActionResult> CreateInvoice([FromBody] CreateInvoiceRequest request)
    {
        var result = await financialService.CreateInvoiceAsync(request);
        return StatusCode(201, result);
    }

    [HttpGet("api/invoices/{id:guid}")]
    public async Task<IActionResult> GetInvoice(Guid id)
    {
        var result = await financialService.GetInvoiceAsync(id);
        return Ok(result);
    }

    [HttpGet("api/invoices")]
    public async Task<IActionResult> GetInvoices([FromQuery] Guid? patientId)
    {
        var result = await financialService.GetInvoicesAsync(patientId);
        return Ok(result);
    }

    [HttpPatch("api/invoices/{id:guid}/status")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateInvoiceStatusRequest request)
    {
        var result = await financialService.UpdateInvoiceStatusAsync(id, request);
        return Ok(result);
    }

    [HttpPost("api/invoices/{id:guid}/payment")]
    public async Task<IActionResult> AddPayment(Guid id, [FromBody] AddPaymentRequest request)
    {
        var result = await financialService.AddPaymentAsync(id, request);
        return Ok(result);
    }

    [HttpGet("api/reports/revenue")]
    public async Task<IActionResult> RevenueReport(
        [FromQuery] DateTime from, [FromQuery] DateTime to)
    {
        var result = await financialService.GetRevenueReportAsync(from, to);
        return Ok(result);
    }
}
