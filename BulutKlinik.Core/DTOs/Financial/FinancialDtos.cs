using BulutKlinik.Core.Entities;

namespace BulutKlinik.Core.DTOs.Financial;

// Service
public record ServiceRequest(
    string Name,
    string? Description,
    decimal Price,
    ServiceCategory Category
);

public record ServiceResponse(
    Guid Id,
    string Name,
    string? Description,
    decimal Price,
    ServiceCategory Category,
    bool IsActive
);

// Invoice
public record CreateInvoiceRequest(
    Guid PatientId,
    Guid DoctorId,
    Guid? AppointmentId,
    decimal DiscountAmount,
    List<InvoiceItemRequest> Items
);

public record InvoiceItemRequest(
    Guid ServiceId,
    int Quantity
);

public record InvoiceResponse(
    Guid Id,
    Guid PatientId,
    string PatientEmail,
    Guid DoctorId,
    string DoctorName,
    Guid? AppointmentId,
    decimal SubTotal,
    decimal DiscountAmount,
    decimal TotalAmount,
    InvoiceStatus Status,
    DateTime CreatedAt,
    DateTime? IssuedAt,
    List<InvoiceItemResponse> Items,
    List<PaymentResponse> Payments
);

public record InvoiceItemResponse(
    Guid Id,
    Guid ServiceId,
    string ServiceName,
    int Quantity,
    decimal UnitPrice,
    decimal TotalPrice
);

public record UpdateInvoiceStatusRequest(InvoiceStatus Status);

// Payment
public record AddPaymentRequest(
    decimal Amount,
    PaymentMethod Method
);

public record PaymentResponse(
    Guid Id,
    decimal Amount,
    PaymentMethod Method,
    DateTime PaidAt
);

// Revenue
public record RevenueReportResponse(
    decimal TotalRevenue,
    int InvoiceCount,
    int PaidCount,
    DateTime From,
    DateTime To
);
