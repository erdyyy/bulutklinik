using BulutKlinik.Core.Entities;
using BulutKlinik.Infrastructure.Persistence;
using BulutKlinik.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;

namespace BulutKlinik.Tests;

public class SlotGeneratorServiceTests : IDisposable
{
    private readonly AppDbContext _db;
    private readonly SlotGeneratorService _sut;
    private readonly Guid _doctorId = Guid.NewGuid();
    // Gelecekteki bir Çarşamba günü seç
    private readonly DateOnly _wednesday;

    public SlotGeneratorServiceTests()
    {
        var opts = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _db  = new AppDbContext(opts);
        _sut = new SlotGeneratorService(_db);

        // Bir sonraki Çarşambayı bul
        var today = DateOnly.FromDateTime(DateTime.Today);
        var daysUntilWed = ((int)DayOfWeek.Wednesday - (int)today.DayOfWeek + 7) % 7;
        _wednesday = daysUntilWed == 0 ? today.AddDays(7) : today.AddDays(daysUntilWed);
    }

    [Fact]
    public async Task CalismaTakvimiOlmayanGun_BosListeDoner()
    {
        // Arrange — takvim yok
        var date = _wednesday;

        // Act
        var result = await _sut.GetAvailableSlotsAsync(_doctorId, date);

        // Assert
        Assert.Empty(result.Slots);
    }

    [Fact]
    public async Task TamGunIzin_BosListeDoner()
    {
        // Arrange
        _db.WorkingSchedules.Add(new WorkingSchedule
        {
            DoctorId = _doctorId,
            DayOfWeek = DayOfWeek.Wednesday,
            StartTime = new TimeOnly(9, 0),
            EndTime   = new TimeOnly(17, 0),
            AppointmentDurationMinutes = 60,
            IsActive  = true
        });
        _db.DoctorLeaves.Add(new DoctorLeave
        {
            DoctorId  = _doctorId,
            LeaveDate = _wednesday,
            IsFullDay = true
        });
        await _db.SaveChangesAsync();

        // Act
        var result = await _sut.GetAvailableSlotsAsync(_doctorId, _wednesday);

        // Assert
        Assert.Empty(result.Slots);
    }

    [Fact]
    public async Task DoluSlot_IsAvailableFalse()
    {
        // Arrange — 09:00–17:00, 60 dk slotlar → 8 slot
        _db.WorkingSchedules.Add(new WorkingSchedule
        {
            DoctorId = _doctorId,
            DayOfWeek = DayOfWeek.Wednesday,
            StartTime = new TimeOnly(9, 0),
            EndTime   = new TimeOnly(17, 0),
            AppointmentDurationMinutes = 60,
            IsActive  = true
        });

        // Hasta ID + doctor id için geçici user gerekli (FK)
        var patientId = Guid.NewGuid();
        _db.Users.Add(new User { Id = patientId, Email = "p@test.com", PasswordHash = "x", PhoneNumber = "0", Role = UserRole.Patient });
        _db.Users.Add(new User { Id = _doctorId, Email = "d@test.com", PasswordHash = "x", PhoneNumber = "0", Role = UserRole.Doctor });
        _db.Doctors.Add(new Doctor { Id = _doctorId, FullName = "Test", Title = "Dr.", Specialty = "Genel" });

        _db.Appointments.Add(new Appointment
        {
            DoctorId        = _doctorId,
            PatientId       = patientId,
            AppointmentDate = _wednesday,
            StartTime       = new TimeOnly(10, 0),
            EndTime         = new TimeOnly(11, 0),
            Status          = AppointmentStatus.Confirmed,
            Type            = AppointmentType.InPerson
        });
        await _db.SaveChangesAsync();

        // Act
        var result = await _sut.GetAvailableSlotsAsync(_doctorId, _wednesday);

        // Assert
        var slot10 = result.Slots.First(s => s.StartTime == new TimeOnly(10, 0));
        Assert.False(slot10.IsAvailable);
    }

    [Fact]
    public async Task YarimGunIzin_IlgiliSlotlarBloklu()
    {
        // Arrange — 09:00–17:00, 60 dk. İzin 09:00-12:00
        _db.WorkingSchedules.Add(new WorkingSchedule
        {
            DoctorId = _doctorId,
            DayOfWeek = DayOfWeek.Wednesday,
            StartTime = new TimeOnly(9, 0),
            EndTime   = new TimeOnly(17, 0),
            AppointmentDurationMinutes = 60,
            IsActive  = true
        });
        _db.DoctorLeaves.Add(new DoctorLeave
        {
            DoctorId  = _doctorId,
            LeaveDate = _wednesday,
            IsFullDay = false,
            StartTime = new TimeOnly(9, 0),
            EndTime   = new TimeOnly(12, 0)
        });
        await _db.SaveChangesAsync();

        // Act
        var result = await _sut.GetAvailableSlotsAsync(_doctorId, _wednesday);

        // Assert — 09:00, 10:00, 11:00 bloklu; 12:00+ açık
        Assert.False(result.Slots.First(s => s.StartTime == new TimeOnly(9, 0)).IsAvailable);
        Assert.False(result.Slots.First(s => s.StartTime == new TimeOnly(10, 0)).IsAvailable);
        Assert.False(result.Slots.First(s => s.StartTime == new TimeOnly(11, 0)).IsAvailable);
        Assert.True(result.Slots.First(s => s.StartTime == new TimeOnly(12, 0)).IsAvailable);
    }

    [Fact]
    public async Task SlotBitisSaatiDogruHesaplaniyor()
    {
        // Arrange — 09:00 başla, 30 dk
        _db.WorkingSchedules.Add(new WorkingSchedule
        {
            DoctorId = _doctorId,
            DayOfWeek = DayOfWeek.Wednesday,
            StartTime = new TimeOnly(9, 0),
            EndTime   = new TimeOnly(10, 0),
            AppointmentDurationMinutes = 30,
            IsActive  = true
        });
        await _db.SaveChangesAsync();

        // Act
        var result = await _sut.GetAvailableSlotsAsync(_doctorId, _wednesday);

        // Assert — 09:00–09:30 ve 09:30–10:00
        Assert.Equal(2, result.Slots.Count);
        Assert.Equal(new TimeOnly(9, 30), result.Slots[0].EndTime);
        Assert.Equal(new TimeOnly(10, 0), result.Slots[1].EndTime);
    }

    public void Dispose() => _db.Dispose();
}
