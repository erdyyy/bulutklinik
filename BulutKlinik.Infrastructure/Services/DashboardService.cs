using BulutKlinik.Core.DTOs.Dashboard;
using BulutKlinik.Core.DTOs.Financial;
using BulutKlinik.Core.Entities;
using BulutKlinik.Core.Interfaces;
using BulutKlinik.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace BulutKlinik.Infrastructure.Services;

public class DashboardService(AppDbContext db) : IDashboardService
{
    public async Task<DashboardResponse> GetDashboardAsync()
    {
        var today    = DateOnly.FromDateTime(DateTime.UtcNow);
        var monthStart = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);

        var todayAppointments = await db.Appointments
            .CountAsync(a => a.AppointmentDate == today && a.Status != AppointmentStatus.Cancelled);

        var monthlyRevenue = await db.Invoices
            .Where(i => i.Status == InvoiceStatus.Paid && i.CreatedAt >= monthStart)
            .SumAsync(i => (decimal?)i.TotalAmount) ?? 0;

        var totalPatients = await db.Users
            .CountAsync(u => u.Role == UserRole.Patient && u.IsActive);

        var pendingInvoices = await db.Invoices
            .CountAsync(i => i.Status == InvoiceStatus.Draft || i.Status == InvoiceStatus.Issued);

        return new DashboardResponse(todayAppointments, monthlyRevenue, totalPatients, pendingInvoices);
    }

    public async Task<List<AppointmentReportItem>> GetAppointmentReportAsync(
        DateTime from, DateTime to, AppointmentStatus? status)
    {
        var fromDate = DateOnly.FromDateTime(from);
        var toDate   = DateOnly.FromDateTime(to);

        var query = db.Appointments
            .Include(a => a.Patient)
            .Include(a => a.Doctor)
            .Where(a => a.AppointmentDate >= fromDate && a.AppointmentDate <= toDate);

        if (status.HasValue)
            query = query.Where(a => a.Status == status.Value);

        var appointments = await query
            .OrderBy(a => a.AppointmentDate).ThenBy(a => a.StartTime)
            .ToListAsync();

        return appointments.Select(a => new AppointmentReportItem(
            a.Id,
            a.Patient?.Email ?? "",
            a.Doctor?.FullName ?? "",
            a.AppointmentDate,
            a.StartTime,
            a.Status,
            a.Type)).ToList();
    }

    public async Task<RevenueReportResponse> GetRevenueReportAsync(DateTime from, DateTime to)
    {
        var fromUtc = from.ToUniversalTime();
        var toUtc   = to.ToUniversalTime();

        var invoices = await db.Invoices
            .Where(i => i.CreatedAt >= fromUtc && i.CreatedAt <= toUtc)
            .ToListAsync();

        var paid    = invoices.Where(i => i.Status == InvoiceStatus.Paid).ToList();
        var revenue = paid.Sum(i => i.TotalAmount);

        return new RevenueReportResponse(revenue, invoices.Count, paid.Count, from, to);
    }

    public async Task<List<StockStatusItem>> GetStockStatusReportAsync()
    {
        var items = await db.StockItems
            .OrderBy(s => s.Name)
            .ToListAsync();

        return items.Select(s => new StockStatusItem(
            s.Id, s.Name, s.Category,
            s.CurrentQuantity, s.MinimumQuantity,
            s.CurrentQuantity <= s.MinimumQuantity,
            s.ExpiryDate)).ToList();
    }
}
