using BulutKlinik.Core.DTOs.Financial;

namespace BulutKlinik.Core.Interfaces;

public interface IInvoiceService
{
    Task<IEnumerable<ServiceDto>> GetServicesAsync();
    Task<ServiceDto> CreateServiceAsync(CreateServiceRequest req);
    Task<InvoiceDto> CreateInvoiceAsync(CreateInvoiceRequest req);
    Task<InvoiceDto> GetInvoiceAsync(Guid id);
    Task<IEnumerable<InvoiceDto>> GetInvoicesAsync(Guid? patientId);
    Task<InvoiceDto> UpdateStatusAsync(Guid id, string status);
    Task<PaymentDto> AddPaymentAsync(Guid invoiceId, AddPaymentRequest req);
    Task<RevenueReportDto> GetRevenueReportAsync(DateTime from, DateTime to);
}
