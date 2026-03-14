using BulutKlinik.Core.DTOs.Dashboard;
using BulutKlinik.Core.Entities;
using BulutKlinik.Core.Interfaces;
using BulutKlinik.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace BulutKlinik.Infrastructure.Services;

public class DashboardService(AppDbContext db) : IDashboardService
{
    public async Task<DashboardDto> GetDashboardAsync()
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var monthStart = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var todayApts  = await db.Appointments.CountAsync(a => a.AppointmentDate == today && a.Status != AppointmentStatus.Cancelled);
        var revenue    = await db.Invoices.Where(i => !i.IsDeleted && i.Status == InvoiceStatus.Paid && i.CreatedAt >= monthStart).SumAsync(i => (decimal?)i.TotalAmount) ?? 0;
        var patients   = await db.Users.CountAsync(u => u.Role == UserRole.Patient);
        var pending    = await db.Invoices.CountAsync(i => !i.IsDeleted && i.Status == InvoiceStatus.Issued);
        return new DashboardDto(todayApts, revenue, patients, pending);
    }

    public async Task<IEnumerable<AppointmentReportDto>> GetAppointmentReportAsync(DateTime from, DateTime to, string? status)
    {
        var fromDate = DateOnly.FromDateTime(DateTime.SpecifyKind(from, DateTimeKind.Utc));
        var toDate   = DateOnly.FromDateTime(DateTime.SpecifyKind(to,   DateTimeKind.Utc));
        var q = db.Appointments.Where(a => a.AppointmentDate >= fromDate && a.AppointmentDate <= toDate)
            .Include(a => a.Doctor);
        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<AppointmentStatus>(status, true, out var s))
            q = (Microsoft.EntityFrameworkCore.Query.IIncludableQueryable<Appointment, Doctor>)q.Where(a => a.Status == s);
        return await q.OrderBy(a => a.AppointmentDate).ThenBy(a => a.StartTime)
            .Select(a => new AppointmentReportDto(a.Id, a.AppointmentDate, a.StartTime.ToString(), a.Doctor.FullName, a.Status.ToString(), a.Type.ToString()))
            .ToListAsync();
    }

    public async Task<StockStatusReportDto> GetStockStatusReportAsync()
    {
        var items = await db.StockItems.Where(s => !s.IsDeleted).ToListAsync();
        var low   = items.Where(s => s.CurrentQuantity <= s.MinimumQuantity && s.CurrentQuantity > 0).ToList();
        var out_  = items.Where(s => s.CurrentQuantity == 0).ToList();
        return new StockStatusReportDto(
            items.Count, low.Count, out_.Count,
            low.Concat(out_).Select(s => new LowStockItemDto(s.Id, s.Name, s.CurrentQuantity, s.MinimumQuantity)).ToList()
        );
    }
}
