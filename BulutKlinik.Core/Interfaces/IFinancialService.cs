using BulutKlinik.Core.DTOs.Financial;
using BulutKlinik.Core.Entities;

namespace BulutKlinik.Core.Interfaces;

public interface IFinancialService
{
    Task<List<ServiceResponse>> GetServicesAsync();
    Task<ServiceResponse> CreateServiceAsync(ServiceRequest request);

    Task<InvoiceResponse> CreateInvoiceAsync(CreateInvoiceRequest request);
    Task<InvoiceResponse> GetInvoiceAsync(Guid invoiceId);
    Task<List<InvoiceResponse>> GetInvoicesAsync(Guid? patientId);
    Task<InvoiceResponse> UpdateInvoiceStatusAsync(Guid invoiceId, UpdateInvoiceStatusRequest request);
    Task<InvoiceResponse> AddPaymentAsync(Guid invoiceId, AddPaymentRequest request);

    Task<RevenueReportResponse> GetRevenueReportAsync(DateTime from, DateTime to);
}
