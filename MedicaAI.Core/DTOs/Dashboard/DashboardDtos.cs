namespace MedicaAI.Core.DTOs.Dashboard;

public record DashboardDto(
    int TodayAppointments,
    decimal MonthlyRevenue,
    int TotalPatients,
    int PendingInvoices
);

public record AppointmentReportDto(
    Guid Id, DateOnly Date, string StartTime,
    string DoctorName, string Status, string Type
);

public record StockStatusReportDto(
    int TotalItems, int LowStockCount, int OutOfStockCount,
    List<LowStockItemDto> LowStockItems
);
public record LowStockItemDto(Guid Id, string Name, int CurrentQuantity, int MinimumQuantity);
