using BulutKlinik.Core.DTOs.Financial;
using BulutKlinik.Core.Entities;
using BulutKlinik.Infrastructure.Persistence;
using BulutKlinik.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;

namespace BulutKlinik.Tests;

public class FinancialServiceTests : IDisposable
{
    private readonly AppDbContext _db;
    private readonly FinancialService _sut;
    private readonly Guid _doctorId  = Guid.NewGuid();
    private readonly Guid _patientId = Guid.NewGuid();
    private readonly Guid _serviceId = Guid.NewGuid();

    public FinancialServiceTests()
    {
        var opts = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _db  = new AppDbContext(opts);
        _sut = new FinancialService(_db);

        _db.Users.Add(new User { Id = _patientId, Email = "hasta@test.com", PasswordHash = "x", PhoneNumber = "0", Role = UserRole.Patient });
        _db.Users.Add(new User { Id = _doctorId,  Email = "dr@test.com",    PasswordHash = "x", PhoneNumber = "0", Role = UserRole.Doctor });
        _db.Doctors.Add(new Doctor { Id = _doctorId, FullName = "Dr. Test", Title = "Dr.", Specialty = "Genel" });
        _db.Services.Add(new Service { Id = _serviceId, Name = "Muayene", Price = 500, Category = ServiceCategory.Consultation });
        _db.SaveChanges();
    }

    // ── Service CRUD ──────────────────────────────────────────────

    [Fact]
    public async Task CreateService_GecerliVeri_KayitOlusturulmali()
    {
        var req = new ServiceRequest("Kan Tahlili", "Tam kan sayımı", 250, ServiceCategory.Lab);

        var result = await _sut.CreateServiceAsync(req);

        Assert.Equal("Kan Tahlili", result.Name);
        Assert.Equal(250, result.Price);
        Assert.Equal(ServiceCategory.Lab, result.Category);
        Assert.True(result.IsActive);
    }

    [Fact]
    public async Task CreateService_BosAd_ArgumentException()
    {
        var req = new ServiceRequest("", null, 100, ServiceCategory.Other);

        await Assert.ThrowsAsync<ArgumentException>(
            () => _sut.CreateServiceAsync(req));
    }

    [Fact]
    public async Task CreateService_NegativeFiyat_ArgumentException()
    {
        var req = new ServiceRequest("Test", null, -50, ServiceCategory.Other);

        await Assert.ThrowsAsync<ArgumentException>(
            () => _sut.CreateServiceAsync(req));
    }

    [Fact]
    public async Task GetServices_AktifServisleriListeler()
    {
        await _sut.CreateServiceAsync(new ServiceRequest("Servis A", null, 100, ServiceCategory.Consultation));
        await _sut.CreateServiceAsync(new ServiceRequest("Servis B", null, 200, ServiceCategory.Lab));

        var result = await _sut.GetServicesAsync();

        // Seed'den gelen 1 + 2 yeni = 3
        Assert.Equal(3, result.Count);
    }

    // ── Invoice ───────────────────────────────────────────────────

    [Fact]
    public async Task CreateInvoice_BirdenFazlaKalem_TutarlarDogruHesaplanmali()
    {
        var service2Id = Guid.NewGuid();
        _db.Services.Add(new Service { Id = service2Id, Name = "Ultrason", Price = 300, Category = ServiceCategory.Procedure });
        _db.SaveChanges();

        // 500*1 + 300*2 = 1100 - 100 discount = 1000
        var req = new CreateInvoiceRequest(
            _patientId, _doctorId, null, 100,
            [new(_serviceId, 1), new(service2Id, 2)]);

        var result = await _sut.CreateInvoiceAsync(req);

        Assert.Equal(1100, result.SubTotal);
        Assert.Equal(100,  result.DiscountAmount);
        Assert.Equal(1000, result.TotalAmount);
        Assert.Equal(2, result.Items.Count);
    }

    [Fact]
    public async Task CreateInvoice_KalemsizFatura_ArgumentException()
    {
        var req = new CreateInvoiceRequest(_patientId, _doctorId, null, 0, []);

        await Assert.ThrowsAsync<ArgumentException>(
            () => _sut.CreateInvoiceAsync(req));
    }

    [Fact]
    public async Task CreateInvoice_VarsayilanDurum_Draft()
    {
        var req = new CreateInvoiceRequest(_patientId, _doctorId, null, 0,
            [new(_serviceId, 1)]);

        var result = await _sut.CreateInvoiceAsync(req);

        Assert.Equal(InvoiceStatus.Draft, result.Status);
    }

    [Fact]
    public async Task UpdateStatus_DrafttenIssued_IssuedAtDolmali()
    {
        var invoice = await _sut.CreateInvoiceAsync(
            new CreateInvoiceRequest(_patientId, _doctorId, null, 0, [new(_serviceId, 1)]));

        var result = await _sut.UpdateInvoiceStatusAsync(
            invoice.Id, new UpdateInvoiceStatusRequest(InvoiceStatus.Issued));

        Assert.Equal(InvoiceStatus.Issued, result.Status);
        Assert.NotNull(result.IssuedAt);
    }

    [Fact]
    public async Task UpdateStatus_OdenmistenDraftGeri_InvalidOperationException()
    {
        var invoice = await _sut.CreateInvoiceAsync(
            new CreateInvoiceRequest(_patientId, _doctorId, null, 0, [new(_serviceId, 1)]));
        await _sut.AddPaymentAsync(invoice.Id, new AddPaymentRequest(500, PaymentMethod.Cash));

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => _sut.UpdateInvoiceStatusAsync(invoice.Id, new UpdateInvoiceStatusRequest(InvoiceStatus.Draft)));
    }

    [Fact]
    public async Task AddPayment_GecerliOdeme_FaturaPaidOlmali()
    {
        var invoice = await _sut.CreateInvoiceAsync(
            new CreateInvoiceRequest(_patientId, _doctorId, null, 0, [new(_serviceId, 1)]));

        var result = await _sut.AddPaymentAsync(invoice.Id,
            new AddPaymentRequest(500, PaymentMethod.CreditCard));

        Assert.Equal(InvoiceStatus.Paid, result.Status);
        Assert.Single(result.Payments);
        Assert.Equal(500, result.Payments[0].Amount);
        Assert.Equal(PaymentMethod.CreditCard, result.Payments[0].Method);
    }

    [Fact]
    public async Task AddPayment_SifirTutar_ArgumentException()
    {
        var invoice = await _sut.CreateInvoiceAsync(
            new CreateInvoiceRequest(_patientId, _doctorId, null, 0, [new(_serviceId, 1)]));

        await Assert.ThrowsAsync<ArgumentException>(
            () => _sut.AddPaymentAsync(invoice.Id, new AddPaymentRequest(0, PaymentMethod.Cash)));
    }

    [Fact]
    public async Task AddPayment_IptalFatura_InvalidOperationException()
    {
        var invoice = await _sut.CreateInvoiceAsync(
            new CreateInvoiceRequest(_patientId, _doctorId, null, 0, [new(_serviceId, 1)]));
        await _sut.UpdateInvoiceStatusAsync(invoice.Id, new UpdateInvoiceStatusRequest(InvoiceStatus.Cancelled));

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => _sut.AddPaymentAsync(invoice.Id, new AddPaymentRequest(500, PaymentMethod.Cash)));
    }

    [Fact]
    public async Task GetInvoices_PatientIdFiltresi_SadeceSonuclarDonmeli()
    {
        var otherId = Guid.NewGuid();
        _db.Users.Add(new User { Id = otherId, Email = "other@test.com", PasswordHash = "x", PhoneNumber = "0", Role = UserRole.Patient });
        _db.SaveChanges();

        await _sut.CreateInvoiceAsync(new CreateInvoiceRequest(_patientId, _doctorId, null, 0, [new(_serviceId, 1)]));
        await _sut.CreateInvoiceAsync(new CreateInvoiceRequest(otherId, _doctorId, null, 0, [new(_serviceId, 1)]));

        var result = await _sut.GetInvoicesAsync(_patientId);

        Assert.Single(result);
        Assert.Equal(_patientId, result[0].PatientId);
    }

    [Fact]
    public async Task GetRevenue_OdenmislerSayilir_TaslakSayilmaz()
    {
        var inv1 = await _sut.CreateInvoiceAsync(
            new CreateInvoiceRequest(_patientId, _doctorId, null, 0, [new(_serviceId, 1)]));
        await _sut.AddPaymentAsync(inv1.Id, new AddPaymentRequest(500, PaymentMethod.Cash)); // Paid

        await _sut.CreateInvoiceAsync(
            new CreateInvoiceRequest(_patientId, _doctorId, null, 0, [new(_serviceId, 1)])); // Draft — sayılmaz

        var result = await _sut.GetRevenueReportAsync(
            DateTime.UtcNow.AddDays(-1), DateTime.UtcNow.AddDays(1));

        Assert.Equal(500, result.TotalRevenue);
        Assert.Equal(1, result.PaidCount);
        Assert.Equal(2, result.InvoiceCount);
    }

    public void Dispose() => _db.Dispose();
}
