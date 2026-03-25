using BulutKlinik.Core.Entities;
using BulutKlinik.Infrastructure.Persistence;
using BulutKlinik.Infrastructure.Services;
using BulutKlinik.Tests.Helpers;
using Xunit;

namespace BulutKlinik.Tests;

public class SlotGeneratorServiceTests
{
    private static (SlotGeneratorService svc, AppDbContext db) Setup() =>
        (new SlotGeneratorService(DbFactory.Create()), DbFactory.Create());

    private static (SlotGeneratorService svc, AppDbContext db, Guid doctorId) SetupWithSchedule(
        TimeOnly start, TimeOnly end, int duration, DayOfWeek day)
    {
        var db       = DbFactory.Create();
        var doctorId = Guid.NewGuid();
        db.WorkingSchedules.Add(new WorkingSchedule
        {
            DoctorId                   = doctorId,
            DayOfWeek                  = day,
            StartTime                  = start,
            EndTime                    = end,
            AppointmentDurationMinutes = duration,
            IsActive                   = true,
        });
        db.SaveChanges();
        var svc = new SlotGeneratorService(db);
        return (svc, db, doctorId);
    }

    [Fact]
    public async Task NoSchedule_ShouldReturnEmptySlots()
    {
        var db       = DbFactory.Create();
        var svc      = new SlotGeneratorService(db);
        var doctorId = Guid.NewGuid();
        var date     = DateOnly.FromDateTime(DateTime.Today);

        var result = await svc.GetAvailableSlotsAsync(doctorId, date);

        Assert.Empty(result.Slots);
    }

    [Fact]
    public async Task WithSchedule_ShouldGenerateCorrectSlotCount()
    {
        // 09:00 – 12:00 with 30-minute slots → 6 slots
        var date = GetNextWeekday(DayOfWeek.Monday);
        var (svc, _, doctorId) = SetupWithSchedule(
            new TimeOnly(9, 0), new TimeOnly(12, 0), 30, DayOfWeek.Monday);

        var result = await svc.GetAvailableSlotsAsync(doctorId, date);

        Assert.Equal(6, result.Slots.Count);
        Assert.All(result.Slots, s => Assert.True(s.IsAvailable));
    }

    [Fact]
    public async Task FullDayLeave_ShouldReturnEmptySlots()
    {
        var date = GetNextWeekday(DayOfWeek.Tuesday);
        var (svc, db, doctorId) = SetupWithSchedule(
            new TimeOnly(9, 0), new TimeOnly(17, 0), 60, DayOfWeek.Tuesday);

        db.DoctorLeaves.Add(new DoctorLeave { DoctorId = doctorId, LeaveDate = date, IsFullDay = true });
        db.SaveChanges();

        var result = await svc.GetAvailableSlotsAsync(doctorId, date);

        Assert.Empty(result.Slots);
    }

    [Fact]
    public async Task HalfDayLeave_ShouldBlockOnlyLeaveWindow()
    {
        // Mesai 09:00-12:00 / 60dk → 3 slot
        // İzin 10:00-11:00 → sadece 10:00 slotu bloklanır
        var date = GetNextWeekday(DayOfWeek.Wednesday);
        var (svc, db, doctorId) = SetupWithSchedule(
            new TimeOnly(9, 0), new TimeOnly(12, 0), 60, DayOfWeek.Wednesday);

        db.DoctorLeaves.Add(new DoctorLeave
        {
            DoctorId  = doctorId,
            LeaveDate = date,
            IsFullDay = false,
            StartTime = new TimeOnly(10, 0),
            EndTime   = new TimeOnly(11, 0),
        });
        db.SaveChanges();

        var result = await svc.GetAvailableSlotsAsync(doctorId, date);

        Assert.Equal(3, result.Slots.Count);
        // 09:00 available, 10:00 blocked, 11:00 available
        Assert.True(result.Slots.First(s => s.StartTime == new TimeOnly(9, 0)).IsAvailable);
        Assert.False(result.Slots.First(s => s.StartTime == new TimeOnly(10, 0)).IsAvailable);
        Assert.True(result.Slots.First(s => s.StartTime == new TimeOnly(11, 0)).IsAvailable);
    }

    [Fact]
    public async Task BookedSlot_ShouldBeMarkedUnavailable()
    {
        var date = GetNextWeekday(DayOfWeek.Thursday);
        var (svc, db, doctorId) = SetupWithSchedule(
            new TimeOnly(9, 0), new TimeOnly(11, 0), 60, DayOfWeek.Thursday);

        var patientId = Guid.NewGuid();
        db.Users.Add(new User { Id = patientId, Email = "p@t.com", PasswordHash = "h", PhoneNumber = "0500", Role = UserRole.Patient });
        db.Appointments.Add(new Appointment
        {
            DoctorId        = doctorId,
            PatientId       = patientId,
            AppointmentDate = date,
            StartTime       = new TimeOnly(9, 0),
            EndTime         = new TimeOnly(10, 0),
            Status          = AppointmentStatus.Confirmed,
            Type            = AppointmentType.InPerson,
        });
        db.SaveChanges();

        var result = await svc.GetAvailableSlotsAsync(doctorId, date);

        Assert.Equal(2, result.Slots.Count);
        Assert.False(result.Slots.First(s => s.StartTime == new TimeOnly(9, 0)).IsAvailable);
        Assert.True(result.Slots.First(s => s.StartTime == new TimeOnly(10, 0)).IsAvailable);
    }

    [Fact]
    public async Task CancelledAppointment_ShouldNotBlockSlot()
    {
        var date = GetNextWeekday(DayOfWeek.Friday);
        var (svc, db, doctorId) = SetupWithSchedule(
            new TimeOnly(9, 0), new TimeOnly(10, 0), 60, DayOfWeek.Friday);

        var patientId = Guid.NewGuid();
        db.Users.Add(new User { Id = patientId, Email = "p2@t.com", PasswordHash = "h", PhoneNumber = "0500", Role = UserRole.Patient });
        db.Appointments.Add(new Appointment
        {
            DoctorId        = doctorId,
            PatientId       = patientId,
            AppointmentDate = date,
            StartTime       = new TimeOnly(9, 0),
            EndTime         = new TimeOnly(10, 0),
            Status          = AppointmentStatus.Cancelled, // iptal
            Type            = AppointmentType.InPerson,
        });
        db.SaveChanges();

        var result = await svc.GetAvailableSlotsAsync(doctorId, date);

        Assert.Single(result.Slots);
        Assert.True(result.Slots[0].IsAvailable);
    }

    // ── Helper ───────────────────────────────────────────────────────────────
    private static DateOnly GetNextWeekday(DayOfWeek day)
    {
        var today = DateOnly.FromDateTime(DateTime.Today);
        var daysAhead = ((int)day - (int)today.DayOfWeek + 7) % 7;
        if (daysAhead == 0) daysAhead = 7;
        return today.AddDays(daysAhead);
    }
}
