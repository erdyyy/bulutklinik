using MedicaAI.Core.DTOs.Financial;
using MedicaAI.Core.Entities;
using MedicaAI.Core.Interfaces;
using MedicaAI.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MedicaAI.Infrastructure.Services;

public class InvoiceService(AppDbContext db) : IInvoiceService
{
    public async Task<IEnumerable<ServiceDto>> GetServicesAsync() =>
        await db.Services.Where(s => !s.IsDeleted && s.IsActive)
            .Select(s => new ServiceDto(s.Id, s.Name, s.Description, s.Price, s.Category.ToString(), s.IsActive))
            .ToListAsync();

    public async Task<ServiceDto> CreateServiceAsync(CreateServiceRequest req)
    {
        if (!Enum.TryParse<ServiceCategory>(req.Category, true, out var cat))
            throw new ArgumentException($"Geçersiz kategori: {req.Category}");
        var s = new Service { Name = req.Name, Description = req.Description, Price = req.Price, Category = cat };
        db.Services.Add(s);
        await db.SaveChangesAsync();
        return new ServiceDto(s.Id, s.Name, s.Description, s.Price, s.Category.ToString(), s.IsActive);
    }

    public async Task<InvoiceDto> CreateInvoiceAsync(CreateInvoiceRequest req)
    {
        var items = new List<InvoiceItem>();
        decimal subTotal = 0;
        foreach (var item in req.Items)
        {
            var svc = await db.Services.FindAsync(item.ServiceId)
                ?? throw new KeyNotFoundException($"Hizmet bulunamadı: {item.ServiceId}");
            var total = svc.Price * item.Quantity;
            subTotal += total;
            items.Add(new InvoiceItem { ServiceId = item.ServiceId, Quantity = item.Quantity, UnitPrice = svc.Price, TotalPrice = total });
        }
        var invoice = new Invoice
        {
            PatientId      = req.PatientId,
            DoctorId       = req.DoctorId,
            AppointmentId  = req.AppointmentId,
            SubTotal       = subTotal,
            DiscountAmount = req.DiscountAmount,
            TotalAmount    = subTotal - req.DiscountAmount,
            Items          = items
        };
        db.Invoices.Add(invoice);
        await db.SaveChangesAsync();
        return await GetInvoiceAsync(invoice.Id);
    }

    public async Task<InvoiceDto> GetInvoiceAsync(Guid id)
    {
        var inv = await db.Invoices
            .Include(i => i.Items).ThenInclude(i => i.Service)
            .Include(i => i.Payments)
            .FirstOrDefaultAsync(i => i.Id == id && !i.IsDeleted)
            ?? throw new KeyNotFoundException("Fatura bulunamadı.");
        return Map(inv);
    }

    public async Task<IEnumerable<InvoiceDto>> GetInvoicesAsync(Guid? patientId)
    {
        var q = db.Invoices.Where(i => !i.IsDeleted)
            .Include(i => i.Items).ThenInclude(i => i.Service)
            .Include(i => i.Payments);
        if (patientId.HasValue) q = (Microsoft.EntityFrameworkCore.Query.IIncludableQueryable<Invoice, ICollection<Payment>>)q.Where(i => i.PatientId == patientId.Value);
        return await q.OrderByDescending(i => i.CreatedAt).Select(i => Map(i)).ToListAsync();
    }

    public async Task<InvoiceDto> UpdateStatusAsync(Guid id, string status)
    {
        if (!Enum.TryParse<InvoiceStatus>(status, true, out var s))
            throw new ArgumentException($"Geçersiz durum: {status}");
        var inv = await db.Invoices.FindAsync(id) ?? throw new KeyNotFoundException("Fatura bulunamadı.");
        inv.Status = s;
        if (s == InvoiceStatus.Issued) inv.IssuedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return await GetInvoiceAsync(id);
    }

    public async Task<PaymentDto> AddPaymentAsync(Guid invoiceId, AddPaymentRequest req)
    {
        if (!Enum.TryParse<PaymentMethod>(req.Method, true, out var method))
            throw new ArgumentException($"Geçersiz ödeme yöntemi: {req.Method}");
        var inv = await db.Invoices.FindAsync(invoiceId) ?? throw new KeyNotFoundException("Fatura bulunamadı.");
        var payment = new Payment { InvoiceId = invoiceId, Amount = req.Amount, Method = method };
        db.Payments.Add(payment);
        inv.Status = InvoiceStatus.Paid;
        await db.SaveChangesAsync();
        return new PaymentDto(payment.Id, invoiceId, payment.Amount, payment.Method.ToString(), payment.PaidAt);
    }

    public async Task<RevenueReportDto> GetRevenueReportAsync(DateTime from, DateTime to)
    {
        var fromUtc = DateTime.SpecifyKind(from, DateTimeKind.Utc);
        var toUtc   = DateTime.SpecifyKind(to,   DateTimeKind.Utc);
        var invoices = await db.Invoices
            .Where(i => !i.IsDeleted && i.Status == InvoiceStatus.Paid && i.CreatedAt >= fromUtc && i.CreatedAt <= toUtc)
            .ToListAsync();
        var daily = invoices.GroupBy(i => DateOnly.FromDateTime(i.CreatedAt))
            .Select(g => new DailyRevenueDto(g.Key, g.Sum(i => i.TotalAmount)))
            .OrderBy(d => d.Date).ToList();
        return new RevenueReportDto(invoices.Sum(i => i.TotalAmount), invoices.Count, invoices.Count, daily);
    }

    private static InvoiceDto Map(Invoice i) => new(
        i.Id, i.PatientId, i.DoctorId, i.AppointmentId,
        i.SubTotal, i.DiscountAmount, i.TotalAmount, i.Status.ToString(),
        i.CreatedAt, i.IssuedAt,
        i.Items.Select(x => new InvoiceItemDto(x.Id, x.ServiceId, x.Service?.Name ?? "", x.Quantity, x.UnitPrice, x.TotalPrice)).ToList(),
        i.Payments.Select(p => new PaymentDto(p.Id, p.InvoiceId, p.Amount, p.Method.ToString(), p.PaidAt)).ToList()
    );
}
