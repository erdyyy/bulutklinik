namespace BulutKlinik.Core.DTOs.Financial;

public record ServiceDto(Guid Id, string Name, string? Description, decimal Price, string Category, bool IsActive);
public record CreateServiceRequest(string Name, string? Description, decimal Price, string Category);

public record InvoiceDto(
    Guid Id, Guid PatientId, Guid DoctorId, Guid? AppointmentId,
    decimal SubTotal, decimal DiscountAmount, decimal TotalAmount,
    string Status, DateTime CreatedAt, DateTime? IssuedAt,
    List<InvoiceItemDto> Items, List<PaymentDto> Payments
);
public record InvoiceItemDto(Guid Id, Guid ServiceId, string ServiceName, int Quantity, decimal UnitPrice, decimal TotalPrice);
public record CreateInvoiceRequest(
    Guid PatientId, Guid DoctorId, Guid? AppointmentId,
    decimal DiscountAmount,
    List<CreateInvoiceItemRequest> Items
);
public record CreateInvoiceItemRequest(Guid ServiceId, int Quantity);

public record PaymentDto(Guid Id, Guid InvoiceId, decimal Amount, string Method, DateTime PaidAt);
public record AddPaymentRequest(decimal Amount, string Method);

public record RevenueReportDto(decimal TotalRevenue, int TotalInvoices, int PaidInvoices, List<DailyRevenueDto> Daily);
public record DailyRevenueDto(DateOnly Date, decimal Amount);
