using BulutKlinik.Core.Entities;
using BulutKlinik.Infrastructure.Persistence;
using BulutKlinik.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;

namespace BulutKlinik.Tests;

public class DashboardServiceTests : IDisposable
{
    private readonly AppDbContext _db;
    private readonly DashboardService _sut;
    private readonly Guid _doctorId  = Guid.NewGuid();
    private readonly Guid _patientId = Guid.NewGuid();
    private readonly Guid _serviceId = Guid.NewGuid();

    public DashboardServiceTests()
    {
        var opts = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _db  = new AppDbContext(opts);
        _sut = new DashboardService(_db);

        _db.Users.Add(new User { Id = _patientId, Email = "hasta@test.com",  PasswordHash = "x", PhoneNumber = "0", Role = UserRole.Patient, IsActive = true });
        _db.Users.Add(new User { Id = _doctorId,  Email = "doktor@test.com", PasswordHash = "x", PhoneNumber = "0", Role = UserRole.Doctor,  IsActive = true });
        _db.Doctors.Add(new Doctor { Id = _doctorId, FullName = "Dr. Test", Title = "Dr.", Specialty = "Genel" });
        _db.Services.Add(new Service { Id = _serviceId, Name = "Muayene", Price = 500, Category = ServiceCategory.Consultation });
        _db.SaveChanges();
    }

    // ── Dashboard KPI ─────────────────────────────────────────────

    [Fact]
    public async Task GetDashboard_BugunkuRandevuSayisi_DogruSayilmali()
    {
        var today = DateOnly.FromDateTime(DateTime.Today);
        _db.Appointments.Add(new Appointment
        {
            DoctorId = _doctorId, PatientId = _patientId,
            AppointmentDate = today, StartTime = new TimeOnly(9, 0), EndTime = new TimeOnly(10, 0),
            Status = AppointmentStatus.Confirmed, Type = AppointmentType.InPerson
        });
        _db.Appointments.Add(new Appointment
        {
            DoctorId = _doctorId, PatientId = _patientId,
            AppointmentDate = today, StartTime = new TimeOnly(10, 0), EndTime = new TimeOnly(11, 0),
            Status = AppointmentStatus.Cancelled, Type = AppointmentType.InPerson  // İptal — sayılmamalı
        });
        _db.SaveChanges();

        var result = await _sut.GetDashboardAsync();

        Assert.Equal(1, result.TodayAppointments);  // Sadece Confirmed sayılır
    }

    [Fact]
    public async Task GetDashboard_ToplamHastaSayisi_DogruSayilmali()
    {
        var patient2 = Guid.NewGuid();
        _db.Users.Add(new User { Id = patient2, Email = "hasta2@test.com", PasswordHash = "x", PhoneNumber = "0", Role = UserRole.Patient, IsActive = true });
        _db.SaveChanges();

        var result = await _sut.GetDashboardAsync();

        Assert.Equal(2, result.TotalPatients);
    }

    [Fact]
    public async Task GetDashboard_BekleyenFatura_DraftVeIssuedSayilir()
    {
        _db.Invoices.Add(new Invoice
        {
            PatientId = _patientId, DoctorId = _doctorId,
            SubTotal = 500, TotalAmount = 500, Status = InvoiceStatus.Draft
        });
        _db.Invoices.Add(new Invoice
        {
            PatientId = _patientId, DoctorId = _doctorId,
            SubTotal = 300, TotalAmount = 300, Status = InvoiceStatus.Issued
        });
        _db.Invoices.Add(new Invoice
        {
            PatientId = _patientId, DoctorId = _doctorId,
            SubTotal = 200, TotalAmount = 200, Status = InvoiceStatus.Paid  // Sayılmamalı
        });
        _db.SaveChanges();

        var result = await _sut.GetDashboardAsync();

        Assert.Equal(2, result.PendingInvoices);
    }

    [Fact]
    public async Task GetDashboard_AylikGelir_SadeceOdenmisler()
    {
        _db.Invoices.Add(new Invoice
        {
            PatientId = _patientId, DoctorId = _doctorId,
            SubTotal = 1000, TotalAmount = 1000, Status = InvoiceStatus.Paid,
            CreatedAt = DateTime.UtcNow
        });
        _db.Invoices.Add(new Invoice
        {
            PatientId = _patientId, DoctorId = _doctorId,
            SubTotal = 500, TotalAmount = 500, Status = InvoiceStatus.Draft,  // Sayılmamalı
            CreatedAt = DateTime.UtcNow
        });
        _db.SaveChanges();

        var result = await _sut.GetDashboardAsync();

        Assert.Equal(1000, result.MonthlyRevenue);
    }

    // ── Appointment Report ────────────────────────────────────────

    [Fact]
    public async Task GetAppointmentReport_TarihAraligi_DogruFiltre()
    {
        var from = DateTime.Today.AddDays(-7);
        var to   = DateTime.Today.AddDays(7);
        var inRange   = DateOnly.FromDateTime(DateTime.Today);
        var outOfRange = DateOnly.FromDateTime(DateTime.Today.AddDays(-30));

        _db.Appointments.Add(new Appointment
        {
            DoctorId = _doctorId, PatientId = _patientId,
            AppointmentDate = inRange, StartTime = new TimeOnly(9, 0), EndTime = new TimeOnly(10, 0),
            Status = AppointmentStatus.Confirmed, Type = AppointmentType.InPerson
        });
        _db.Appointments.Add(new Appointment
        {
            DoctorId = _doctorId, PatientId = _patientId,
            AppointmentDate = outOfRange, StartTime = new TimeOnly(9, 0), EndTime = new TimeOnly(10, 0),
            Status = AppointmentStatus.Confirmed, Type = AppointmentType.InPerson
        });
        _db.SaveChanges();

        var result = await _sut.GetAppointmentReportAsync(from, to, null);

        Assert.Single(result);
    }

    [Fact]
    public async Task GetAppointmentReport_StatusFiltresi_SadeceIlgiliDurum()
    {
        var today = DateOnly.FromDateTime(DateTime.Today);
        _db.Appointments.Add(new Appointment
        {
            DoctorId = _doctorId, PatientId = _patientId,
            AppointmentDate = today, StartTime = new TimeOnly(9, 0), EndTime = new TimeOnly(10, 0),
            Status = AppointmentStatus.Confirmed, Type = AppointmentType.InPerson
        });
        _db.Appointments.Add(new Appointment
        {
            DoctorId = _doctorId, PatientId = _patientId,
            AppointmentDate = today, StartTime = new TimeOnly(11, 0), EndTime = new TimeOnly(12, 0),
            Status = AppointmentStatus.Cancelled, Type = AppointmentType.InPerson
        });
        _db.SaveChanges();

        var result = await _sut.GetAppointmentReportAsync(
            DateTime.Today.AddDays(-1), DateTime.Today.AddDays(1),
            AppointmentStatus.Confirmed);

        Assert.Single(result);
        Assert.Equal(AppointmentStatus.Confirmed, result[0].Status);
    }

    // ── Revenue Report ────────────────────────────────────────────

    [Fact]
    public async Task GetRevenueReport_TarihDisi_SayilmamalI()
    {
        _db.Invoices.Add(new Invoice
        {
            PatientId = _patientId, DoctorId = _doctorId,
            SubTotal = 1000, TotalAmount = 1000, Status = InvoiceStatus.Paid,
            CreatedAt = DateTime.UtcNow.AddDays(-60)  // 60 gün önce
        });
        _db.SaveChanges();

        var result = await _sut.GetRevenueReportAsync(
            DateTime.UtcNow.AddDays(-30), DateTime.UtcNow);

        Assert.Equal(0, result.TotalRevenue);
        Assert.Equal(0, result.InvoiceCount);
    }

    // ── Stock Status Report ───────────────────────────────────────

    [Fact]
    public async Task GetStockStatusReport_TumKalemleriListeler()
    {
        _db.StockItems.Add(new StockItem { Name = "A", Unit = "Adet", CurrentQuantity = 100, MinimumQuantity = 20 });
        _db.StockItems.Add(new StockItem { Name = "B", Unit = "Kutu", CurrentQuantity = 5,   MinimumQuantity = 10 });
        _db.SaveChanges();

        var result = await _sut.GetStockStatusReportAsync();

        Assert.Equal(2, result.Count);
        var b = result.First(s => s.Name == "B");
        Assert.True(b.IsLow);  // 5 <= 10
        var a = result.First(s => s.Name == "A");
        Assert.False(a.IsLow); // 100 > 20
    }

    public void Dispose() => _db.Dispose();
}
