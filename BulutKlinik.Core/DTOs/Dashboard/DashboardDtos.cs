using BulutKlinik.Core.Entities;

namespace BulutKlinik.Core.DTOs.Dashboard;

public record DashboardResponse(
    int TodayAppointments,
    decimal MonthlyRevenue,
    int TotalPatients,
    int PendingInvoices
);

public record AppointmentReportItem(
    Guid Id,
    string PatientEmail,
    string DoctorName,
    DateOnly AppointmentDate,
    TimeOnly StartTime,
    AppointmentStatus Status,
    AppointmentType Type
);

public record StockStatusItem(
    Guid Id,
    string Name,
    string? Category,
    decimal CurrentQuantity,
    decimal MinimumQuantity,
    bool IsLow,
    DateTime? ExpiryDate
);
