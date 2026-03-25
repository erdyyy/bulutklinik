using MedicaAI.Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MedicaAI.API.Controllers;

[ApiController]
[Authorize(Roles = "Doctor,Staff")]
public class DashboardController(IDashboardService svc) : ControllerBase
{
    [HttpGet("api/dashboard")]
    public async Task<IActionResult> GetDashboard() => Ok(await svc.GetDashboardAsync());

    [HttpGet("api/reports/appointments")]
    public async Task<IActionResult> AppointmentReport(
        [FromQuery] DateTime from, [FromQuery] DateTime to, [FromQuery] string? status) =>
        Ok(await svc.GetAppointmentReportAsync(from, to, status));

    [HttpGet("api/reports/stock-status")]
    public async Task<IActionResult> StockStatus() => Ok(await svc.GetStockStatusReportAsync());
}
