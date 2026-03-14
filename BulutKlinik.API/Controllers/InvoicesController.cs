using BulutKlinik.Core.DTOs.Financial;
using BulutKlinik.Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BulutKlinik.API.Controllers;

[ApiController]
[Authorize]
public class InvoicesController(IInvoiceService svc) : ControllerBase
{
    [HttpGet("api/services")]
    public async Task<IActionResult> GetServices() => Ok(await svc.GetServicesAsync());

    [HttpPost("api/services")]
    [Authorize(Roles = "Doctor,Staff")]
    public async Task<IActionResult> CreateService(CreateServiceRequest req) =>
        Ok(await svc.CreateServiceAsync(req));

    [HttpPost("api/invoices")]
    [Authorize(Roles = "Doctor,Staff")]
    public async Task<IActionResult> CreateInvoice(CreateInvoiceRequest req) =>
        Ok(await svc.CreateInvoiceAsync(req));

    [HttpGet("api/invoices/{id:guid}")]
    public async Task<IActionResult> GetInvoice(Guid id) => Ok(await svc.GetInvoiceAsync(id));

    [HttpGet("api/invoices")]
    public async Task<IActionResult> GetInvoices([FromQuery] Guid? patientId) =>
        Ok(await svc.GetInvoicesAsync(patientId));

    [HttpPatch("api/invoices/{id:guid}/status")]
    [Authorize(Roles = "Doctor,Staff")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateInvoiceStatusRequest req) =>
        Ok(await svc.UpdateStatusAsync(id, req.Status));

    [HttpPost("api/invoices/{id:guid}/payment")]
    [Authorize(Roles = "Doctor,Staff")]
    public async Task<IActionResult> AddPayment(Guid id, AddPaymentRequest req) =>
        Ok(await svc.AddPaymentAsync(id, req));

    [HttpGet("api/reports/revenue")]
    [Authorize(Roles = "Doctor,Staff")]
    public async Task<IActionResult> GetRevenue([FromQuery] DateTime from, [FromQuery] DateTime to) =>
        Ok(await svc.GetRevenueReportAsync(from, to));
}

public record UpdateInvoiceStatusRequest(string Status);
