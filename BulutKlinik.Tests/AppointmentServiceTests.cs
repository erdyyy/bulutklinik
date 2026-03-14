using BulutKlinik.Core.DTOs.Appointment;
using BulutKlinik.Core.Entities;
using BulutKlinik.Core.Interfaces;
using BulutKlinik.Infrastructure.Persistence;
using BulutKlinik.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace BulutKlinik.Tests;

public class AppointmentServiceTests : IDisposable
{
    private readonly AppDbContext _db;
    private readonly AppointmentService _sut;
    private readonly Guid _doctorId = Guid.NewGuid();
    private readonly Guid _patientId = Guid.NewGuid();
    private readonly DateOnly _date;

    public AppointmentServiceTests()
    {
        var opts = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _db = new AppDbContext(opts);

        var slotGen = new SlotGeneratorService(_db);
        var notificationMock = new Mock<INotificationService>();
        notificationMock.Setup(n => n.LogAppointmentCreatedAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<string>()))
            .Returns(Task.CompletedTask);

        _sut = new AppointmentService(_db, slotGen, notificationMock.Object);

        // Gelecekteki bir Pazartesi
        var today = DateOnly.FromDateTime(DateTime.Today);
        var daysUntilMon = ((int)DayOfWeek.Monday - (int)today.DayOfWeek + 7) % 7;
        _date = daysUntilMon == 0 ? today.AddDays(7) : today.AddDays(daysUntilMon);

        // Seed verisi
        _db.Users.Add(new User { Id = _patientId, Email = "hasta@test.com", PasswordHash = "x", PhoneNumber = "0", Role = UserRole.Patient });
        _db.Users.Add(new User { Id = _doctorId,  Email = "doktor@test.com", PasswordHash = "x", PhoneNumber = "0", Role = UserRole.Doctor });
        _db.Doctors.Add(new Doctor { Id = _doctorId, FullName = "Test Doktor", Title = "Dr.", Specialty = "Genel" });
        _db.WorkingSchedules.Add(new WorkingSchedule
        {
            DoctorId = _doctorId,
            DayOfWeek = DayOfWeek.Monday,
            StartTime = new TimeOnly(9, 0),
            EndTime   = new TimeOnly(17, 0),
            AppointmentDurationMinutes = 60,
            IsActive  = true
        });
        _db.SaveChanges();
    }

    [Fact]
    public async Task DoluSlotaRandevu_InvalidOperationException()
    {
        // Arrange — 10:00 slotunu doldur
        _db.Appointments.Add(new Appointment
        {
            DoctorId        = _doctorId,
            PatientId       = _patientId,
            AppointmentDate = _date,
            StartTime       = new TimeOnly(10, 0),
            EndTime         = new TimeOnly(11, 0),
            Status          = AppointmentStatus.Confirmed,
            Type            = AppointmentType.InPerson
        });
        _db.SaveChanges();

        var req = new CreateAppointmentRequest(_doctorId, _date, new TimeOnly(10, 0), "InPerson", null);

        // Act & Assert
        await Assert.ThrowsAsync<InvalidOperationException>(
            () => _sut.CreateAsync(_patientId, req));
    }

    [Fact]
    public async Task IptalEdilmisRandevovaIptal_InvalidOperationException()
    {
        // Arrange
        var appt = new Appointment
        {
            DoctorId        = _doctorId,
            PatientId       = _patientId,
            AppointmentDate = _date,
            StartTime       = new TimeOnly(9, 0),
            EndTime         = new TimeOnly(10, 0),
            Status          = AppointmentStatus.Cancelled,
            Type            = AppointmentType.InPerson
        };
        _db.Appointments.Add(appt);
        _db.SaveChanges();

        var req = new UpdateStatusRequest("Cancelled", null);

        // Act & Assert
        await Assert.ThrowsAsync<InvalidOperationException>(
            () => _sut.UpdateStatusAsync(appt.Id, _patientId, req));
    }

    public void Dispose() => _db.Dispose();
}
