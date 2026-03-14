using BulutKlinik.Core.DTOs.Financial;
using BulutKlinik.Core.Entities;
using BulutKlinik.Infrastructure.Persistence;
using BulutKlinik.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;

namespace BulutKlinik.Tests;

public class InvoiceServiceTests : IDisposable
{
    private readonly AppDbContext _db;
    private readonly FinancialService _sut;
    private readonly Guid _doctorId  = Guid.NewGuid();
    private readonly Guid _patientId = Guid.NewGuid();
    private readonly Guid _serviceId = Guid.NewGuid();

    public InvoiceServiceTests()
    {
        var opts = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _db  = new AppDbContext(opts);
        _sut = new FinancialService(_db);

        // Seed
        _db.Users.Add(new User { Id = _patientId, Email = "hasta@test.com", PasswordHash = "x", PhoneNumber = "0", Role = UserRole.Patient });
        _db.Users.Add(new User { Id = _doctorId,  Email = "doktor@test.com", PasswordHash = "x", PhoneNumber = "0", Role = UserRole.Doctor });
        _db.Doctors.Add(new Doctor { Id = _doctorId, FullName = "Test Dr.", Title = "Dr.", Specialty = "Genel" });
        _db.Services.Add(new Service { Id = _serviceId, Name = "Muayene", Price = 500, Category = ServiceCategory.Consultation });
        _db.SaveChanges();
    }

    [Fact]
    public async Task FaturaTutarHesabi_SubTotalEksiDiscount_EqualsTotalAmount()
    {
        // Arrange
        var req = new CreateInvoiceRequest(
            PatientId:      _patientId,
            DoctorId:       _doctorId,
            AppointmentId:  null,
            DiscountAmount: 50,
            Items: [new InvoiceItemRequest(_serviceId, 2)]  // 500 * 2 = 1000
        );

        // Act
        var result = await _sut.CreateInvoiceAsync(req);

        // Assert
        Assert.Equal(1000, result.SubTotal);
        Assert.Equal(50,   result.DiscountAmount);
        Assert.Equal(950,  result.TotalAmount);   // 1000 - 50
    }

    [Fact]
    public async Task SifirIndirim_TotalEqualSubTotal()
    {
        var req = new CreateInvoiceRequest(
            PatientId:      _patientId,
            DoctorId:       _doctorId,
            AppointmentId:  null,
            DiscountAmount: 0,
            Items: [new InvoiceItemRequest(_serviceId, 1)]  // 500
        );

        var result = await _sut.CreateInvoiceAsync(req);

        Assert.Equal(result.SubTotal, result.TotalAmount);
    }

    public void Dispose() => _db.Dispose();
}
