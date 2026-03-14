using BulutKlinik.Core.DTOs.Financial;
using BulutKlinik.Core.Entities;
using BulutKlinik.Core.Interfaces;
using BulutKlinik.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace BulutKlinik.Infrastructure.Services;

public class FinancialService(AppDbContext db) : IFinancialService
{
    // ── Hizmetler ─────────────────────────────────────────────────

    public async Task<List<ServiceResponse>> GetServicesAsync()
    {
        var services = await db.Services
            .Where(s => s.IsActive)
            .OrderBy(s => s.Category).ThenBy(s => s.Name)
            .ToListAsync();
        return services.Select(ToResponse).ToList();
    }

    public async Task<ServiceResponse> CreateServiceAsync(ServiceRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            throw new ArgumentException("Hizmet adı boş olamaz.");
        if (request.Price < 0)
            throw new ArgumentException("Fiyat negatif olamaz.");

        var service = new Service
        {
            Name        = request.Name,
            Description = request.Description,
            Price       = request.Price,
            Category    = request.Category
        };
        db.Services.Add(service);
        await db.SaveChangesAsync();
        return ToResponse(service);
    }

    // ── Faturalar ─────────────────────────────────────────────────

    public async Task<InvoiceResponse> CreateInvoiceAsync(CreateInvoiceRequest request)
    {
        if (!request.Items.Any())
            throw new ArgumentException("Faturada en az bir kalem olmalıdır.");

        var invoice = new Invoice
        {
            PatientId      = request.PatientId,
            DoctorId       = request.DoctorId,
            AppointmentId  = request.AppointmentId,
            DiscountAmount = request.DiscountAmount
        };

        decimal subTotal = 0;
        foreach (var item in request.Items)
        {
            var service = await db.Services.FindAsync(item.ServiceId)
                ?? throw new KeyNotFoundException($"Hizmet bulunamadı: {item.ServiceId}");

            var invoiceItem = new InvoiceItem
            {
                ServiceId  = item.ServiceId,
                Quantity   = item.Quantity,
                UnitPrice  = service.Price,
                TotalPrice = service.Price * item.Quantity
            };
            invoice.Items.Add(invoiceItem);
            subTotal += invoiceItem.TotalPrice;
        }

        invoice.SubTotal    = subTotal;
        invoice.TotalAmount = subTotal - request.DiscountAmount;

        db.Invoices.Add(invoice);
        await db.SaveChangesAsync();

        return await GetInvoiceAsync(invoice.Id);
    }

    public async Task<InvoiceResponse> GetInvoiceAsync(Guid invoiceId)
    {
        var invoice = await db.Invoices
            .Include(i => i.Patient)
            .Include(i => i.Doctor)
            .Include(i => i.Items).ThenInclude(ii => ii.Service)
            .Include(i => i.Payments)
            .FirstOrDefaultAsync(i => i.Id == invoiceId)
            ?? throw new KeyNotFoundException("Fatura bulunamadı.");

        return ToResponse(invoice);
    }

    public async Task<List<InvoiceResponse>> GetInvoicesAsync(Guid? patientId)
    {
        var query = db.Invoices
            .Include(i => i.Patient)
            .Include(i => i.Doctor)
            .Include(i => i.Items).ThenInclude(ii => ii.Service)
            .Include(i => i.Payments)
            .AsQueryable();

        if (patientId.HasValue)
            query = query.Where(i => i.PatientId == patientId.Value);

        var invoices = await query.OrderByDescending(i => i.CreatedAt).ToListAsync();
        return invoices.Select(ToResponse).ToList();
    }

    public async Task<InvoiceResponse> UpdateInvoiceStatusAsync(Guid invoiceId, UpdateInvoiceStatusRequest request)
    {
        var invoice = await db.Invoices.FindAsync(invoiceId)
            ?? throw new KeyNotFoundException("Fatura bulunamadı.");

        if (invoice.Status == InvoiceStatus.Paid && request.Status != InvoiceStatus.Cancelled)
            throw new InvalidOperationException("Ödenmiş fatura durumu değiştirilemez.");

        invoice.Status   = request.Status;
        invoice.IssuedAt = request.Status == InvoiceStatus.Issued ? DateTime.UtcNow : invoice.IssuedAt;
        await db.SaveChangesAsync();

        return await GetInvoiceAsync(invoiceId);
    }

    public async Task<InvoiceResponse> AddPaymentAsync(Guid invoiceId, AddPaymentRequest request)
    {
        var invoice = await db.Invoices.FindAsync(invoiceId)
            ?? throw new KeyNotFoundException("Fatura bulunamadı.");

        if (invoice.Status == InvoiceStatus.Cancelled)
            throw new InvalidOperationException("İptal edilmiş faturaya ödeme eklenemez.");
        if (request.Amount <= 0)
            throw new ArgumentException("Ödeme tutarı sıfırdan büyük olmalıdır.");

        var payment = new Payment
        {
            InvoiceId = invoiceId,
            Amount    = request.Amount,
            Method    = request.Method
        };
        db.Payments.Add(payment);
        invoice.Status = InvoiceStatus.Paid;
        await db.SaveChangesAsync();

        return await GetInvoiceAsync(invoiceId);
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

    // ── Mappers ───────────────────────────────────────────────────
    private static ServiceResponse ToResponse(Service s) => new(
        s.Id, s.Name, s.Description, s.Price, s.Category, s.IsActive);

    private static InvoiceResponse ToResponse(Invoice i) => new(
        i.Id,
        i.PatientId, i.Patient?.Email ?? "",
        i.DoctorId,  i.Doctor?.FullName ?? "",
        i.AppointmentId,
        i.SubTotal, i.DiscountAmount, i.TotalAmount,
        i.Status, i.CreatedAt, i.IssuedAt,
        i.Items.Select(ii => new InvoiceItemResponse(
            ii.Id, ii.ServiceId, ii.Service?.Name ?? "",
            ii.Quantity, ii.UnitPrice, ii.TotalPrice)).ToList(),
        i.Payments.Select(p => new PaymentResponse(
            p.Id, p.Amount, p.Method, p.PaidAt)).ToList());
}
