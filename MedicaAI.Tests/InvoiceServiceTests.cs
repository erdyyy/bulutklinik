using MedicaAI.Core.DTOs.Financial;
using MedicaAI.Core.Entities;
using MedicaAI.Infrastructure.Persistence;
using MedicaAI.Infrastructure.Services;
using MedicaAI.Tests.Helpers;
using Xunit;

namespace MedicaAI.Tests;

public class InvoiceServiceTests
{
    private static (InvoiceService svc, AppDbContext db, Guid patientId, Guid doctorId) Setup()
    {
        var db        = DbFactory.Create();
        var patientId = Guid.NewGuid();
        var doctorId  = Guid.NewGuid();
        db.Users.Add(new User { Id = patientId, Email = "p@t.com", PasswordHash = "h", PhoneNumber = "0500", Role = UserRole.Patient });
        db.SaveChanges();
        return (new InvoiceService(db), db, patientId, doctorId);
    }

    [Fact]
    public async Task CreateService_ShouldPersistAndReturn()
    {
        var (svc, _, _, _) = Setup();

        var dto = await svc.CreateServiceAsync(new CreateServiceRequest("Botoks", "Yüz bölgesi", 1200m, "Procedure"));

        Assert.Equal("Botoks",   dto.Name);
        Assert.Equal(1200m,      dto.Price);
        Assert.Equal("Procedure",dto.Category);
        Assert.True(dto.IsActive);
    }

    [Fact]
    public async Task CreateService_InvalidCategory_ShouldThrow()
    {
        var (svc, _, _, _) = Setup();

        await Assert.ThrowsAsync<ArgumentException>(
            () => svc.CreateServiceAsync(new CreateServiceRequest("Test", null, 100m, "GECERSIZ_KATEGORI")));
    }

    [Fact]
    public async Task CreateInvoice_ShouldCalculateTotalsCorrectly()
    {
        var (svc, db, patientId, doctorId) = Setup();

        // İki hizmet ekle
        var s1 = await svc.CreateServiceAsync(new CreateServiceRequest("Botoks", null, 1000m, "Procedure"));
        var s2 = await svc.CreateServiceAsync(new CreateServiceRequest("Konsültasyon", null, 200m, "Consultation"));

        var req = new CreateInvoiceRequest(
            patientId, doctorId, null,
            DiscountAmount: 100m,
            Items: new List<CreateInvoiceItemRequest>
            {
                new(s1.Id, Quantity: 1),
                new(s2.Id, Quantity: 2),
            });

        var invoice = await svc.CreateInvoiceAsync(req);

        // SubTotal = 1000*1 + 200*2 = 1400
        Assert.Equal(1400m, invoice.SubTotal);
        Assert.Equal(100m,  invoice.DiscountAmount);
        Assert.Equal(1300m, invoice.TotalAmount);
        Assert.Equal(2,     invoice.Items.Count);
    }

    [Fact]
    public async Task CreateInvoice_WithUnknownService_ShouldThrow()
    {
        var (svc, _, patientId, doctorId) = Setup();

        var req = new CreateInvoiceRequest(
            patientId, doctorId, null, 0m,
            Items: new List<CreateInvoiceItemRequest> { new(Guid.NewGuid(), 1) });

        await Assert.ThrowsAsync<KeyNotFoundException>(() => svc.CreateInvoiceAsync(req));
    }

    [Fact]
    public async Task AddPayment_ShouldMarkInvoiceAsPaid()
    {
        var (svc, _, patientId, doctorId) = Setup();
        var service = await svc.CreateServiceAsync(new CreateServiceRequest("Hizmet", null, 500m, "Procedure"));
        var invoice = await svc.CreateInvoiceAsync(new CreateInvoiceRequest(
            patientId, doctorId, null, 0m,
            new List<CreateInvoiceItemRequest> { new(service.Id, 1) }));

        var payment = await svc.AddPaymentAsync(invoice.Id, new AddPaymentRequest(500m, "Cash"));

        Assert.Equal(500m, payment.Amount);

        var updated = await svc.GetInvoiceAsync(invoice.Id);
        Assert.Equal("Paid", updated.Status);
    }

    [Fact]
    public async Task UpdateStatus_ToIssued_ShouldSetIssuedAt()
    {
        var (svc, _, patientId, doctorId) = Setup();
        var service = await svc.CreateServiceAsync(new CreateServiceRequest("S", null, 100m, "Procedure"));
        var invoice = await svc.CreateInvoiceAsync(new CreateInvoiceRequest(
            patientId, doctorId, null, 0m,
            new List<CreateInvoiceItemRequest> { new(service.Id, 1) }));

        var updated = await svc.UpdateStatusAsync(invoice.Id, "Issued");

        Assert.Equal("Issued", updated.Status);
        Assert.NotNull(updated.IssuedAt);
    }

    [Fact]
    public async Task GetRevenueReport_ShouldSumPaidInvoicesOnly()
    {
        var (svc, _, patientId, doctorId) = Setup();
        var service = await svc.CreateServiceAsync(new CreateServiceRequest("S", null, 1000m, "Procedure"));

        var inv1 = await svc.CreateInvoiceAsync(new CreateInvoiceRequest(
            patientId, doctorId, null, 0m,
            new List<CreateInvoiceItemRequest> { new(service.Id, 1) }));
        var inv2 = await svc.CreateInvoiceAsync(new CreateInvoiceRequest(
            patientId, doctorId, null, 0m,
            new List<CreateInvoiceItemRequest> { new(service.Id, 1) }));

        // Sadece inv1'i öde
        await svc.AddPaymentAsync(inv1.Id, new AddPaymentRequest(1000m, "Cash"));

        var report = await svc.GetRevenueReportAsync(
            DateTime.UtcNow.AddDays(-1),
            DateTime.UtcNow.AddDays(1));

        Assert.Equal(1000m, report.TotalRevenue);
        Assert.Equal(1,     report.PaidInvoices);
    }
}
