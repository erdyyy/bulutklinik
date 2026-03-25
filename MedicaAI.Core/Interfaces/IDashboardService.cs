using MedicaAI.Core.DTOs.Dashboard;

namespace MedicaAI.Core.Interfaces;

public interface IDashboardService
{
    Task<DashboardDto> GetDashboardAsync();
    Task<IEnumerable<AppointmentReportDto>> GetAppointmentReportAsync(DateTime from, DateTime to, string? status);
    Task<StockStatusReportDto> GetStockStatusReportAsync();
}
