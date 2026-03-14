using BulutKlinik.Core.DTOs.Dashboard;
using BulutKlinik.Core.DTOs.Financial;
using BulutKlinik.Core.Entities;

namespace BulutKlinik.Core.Interfaces;

public interface IDashboardService
{
    Task<DashboardResponse> GetDashboardAsync();
    Task<List<AppointmentReportItem>> GetAppointmentReportAsync(DateTime from, DateTime to, AppointmentStatus? status);
    Task<RevenueReportResponse> GetRevenueReportAsync(DateTime from, DateTime to);
    Task<List<StockStatusItem>> GetStockStatusReportAsync();
}
