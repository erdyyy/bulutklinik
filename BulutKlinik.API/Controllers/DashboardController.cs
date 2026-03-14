using BulutKlinik.Core.DTOs.Financial;
using BulutKlinik.Core.Entities;
using BulutKlinik.Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BulutKlinik.API.Controllers;

[ApiController]
[Authorize(Roles = "Doctor,Staff")]
public class DashboardController(IDashboardService dashboardService) : ControllerBase
{
    [HttpGet("api/dashboard")]
    public async Task<IActionResult> GetDashboard()
    {
        var result = await dashboardService.GetDashboardAsync();
        return Ok(result);
    }

    [HttpGet("api/reports/appointments")]
    public async Task<IActionResult> AppointmentReport(
        [FromQuery] DateTime from,
        [FromQuery] DateTime to,
        [FromQuery] AppointmentStatus? status)
    {
        var result = await dashboardService.GetAppointmentReportAsync(from, to, status);
        return Ok(result);
    }

    [HttpGet("api/reports/stock-status")]
    public async Task<IActionResult> StockStatusReport()
    {
        var result = await dashboardService.GetStockStatusReportAsync();
        return Ok(result);
    }
}
