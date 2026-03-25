using MedicaAI.Core.DTOs.Appointment;
using MedicaAI.Core.Entities;
using MedicaAI.Core.Interfaces;
using MedicaAI.Infrastructure.Persistence;
using MedicaAI.Infrastructure.Services;
using MedicaAI.Tests.Helpers;
using Moq;
using Xunit;

namespace MedicaAI.Tests;

public class AppointmentServiceTests
{
    private static (AppDbContext db, AppointmentService svc, Mock<ISlotGeneratorService> slotMock,
        Guid doctorId, Guid patientId)
        Setup(DateOnly date, TimeOnly slotTime, bool slotAvailable = true)
    {
        var db        = DbFactory.Create();
        var doctorId  = Guid.NewGuid();
        var patientId = Guid.NewGuid();

        // Doctor requires both a User and a Doctor entity (shared PK)
        db.Users.Add(new User { Id = doctorId, Email = "dr@t.com", PasswordHash = "h", PhoneNumber = "0501", Role = UserRole.Doctor });
        db.Doctors.Add(new Doctor { Id = doctorId, FullName = "Dr. Test", Title = "Uzm.", Specialty = "Estetik" });
        db.Users.Add(new User { Id = patientId, Email = "p@t.com", PasswordHash = "h", PhoneNumber = "0500", Role = UserRole.Patient });
        db.WorkingSchedules.Add(new WorkingSchedule
        {
            DoctorId                   = doctorId,
            DayOfWeek                  = date.DayOfWeek,
            StartTime                  = slotTime,
            EndTime                    = slotTime.AddMinutes(60),
            AppointmentDurationMinutes = 60,
            IsActive                   = true,
        });
        db.SaveChanges();

        var slotMock = new Mock<ISlotGeneratorService>();
        slotMock.Setup(s => s.GetAvailableSlotsAsync(doctorId, date))
                .ReturnsAsync(new AvailableSlotsResponse(doctorId, date,
                    new List<TimeSlot> { new(slotTime, slotTime.AddMinutes(60), slotAvailable) }));

        var svc = new AppointmentService(db, slotMock.Object);
        return (db, svc, slotMock, doctorId, patientId);
    }

    private static DateOnly NextMonday() =>
        DateOnly.FromDateTime(DateTime.Today.AddDays(((int)DayOfWeek.Monday - (int)DateTime.Today.DayOfWeek + 7) % 7 is 0 ? 7 : ((int)DayOfWeek.Monday - (int)DateTime.Today.DayOfWeek + 7) % 7));

    [Fact]
    public async Task Create_ShouldPersistAppointmentWithConfirmedStatus()
    {
        var date     = NextMonday();
        var slot     = new TimeOnly(10, 0);
        var (_, svc, _, doctorId, patientId) = Setup(date, slot);

        var req = new CreateAppointmentRequest(doctorId, date, slot, "InPerson", "Not");
        var res = await svc.CreateAsync(patientId, req);

        Assert.Equal("Confirmed", res.Status);
        Assert.Equal(date,        res.AppointmentDate);
        Assert.Equal(slot,        res.StartTime);
        Assert.Equal(doctorId,    res.DoctorId);
        Assert.Equal(patientId,   res.PatientId);
    }

    [Fact]
    public async Task Create_UnavailableSlot_ShouldThrow()
    {
        var date = NextMonday();
        var slot = new TimeOnly(10, 0);
        var (_, svc, _, doctorId, patientId) = Setup(date, slot, slotAvailable: false);

        var req = new CreateAppointmentRequest(doctorId, date, slot, "InPerson", null);

        await Assert.ThrowsAsync<InvalidOperationException>(() => svc.CreateAsync(patientId, req));
    }

    [Fact]
    public async Task Create_NonExistentSlotTime_ShouldThrow()
    {
        var date = NextMonday();
        var slot = new TimeOnly(10, 0);
        var (_, svc, _, doctorId, patientId) = Setup(date, slot);

        // Ask for 11:00 but only 10:00 slot exists in mock
        var req = new CreateAppointmentRequest(doctorId, date, new TimeOnly(11, 0), "InPerson", null);

        await Assert.ThrowsAsync<InvalidOperationException>(() => svc.CreateAsync(patientId, req));
    }

    [Fact]
    public async Task Create_InvalidType_ShouldThrow()
    {
        var date = NextMonday();
        var slot = new TimeOnly(10, 0);
        var (_, svc, _, doctorId, patientId) = Setup(date, slot);

        var req = new CreateAppointmentRequest(doctorId, date, slot, "GECERSIZ", null);

        await Assert.ThrowsAsync<ArgumentException>(() => svc.CreateAsync(patientId, req));
    }

    [Fact]
    public async Task UpdateStatus_Cancel_ShouldSetCancellationReason()
    {
        var date = NextMonday();
        var slot = new TimeOnly(10, 0);
        var (db, svc, _, doctorId, patientId) = Setup(date, slot);

        var created = await svc.CreateAsync(patientId,
            new CreateAppointmentRequest(doctorId, date, slot, "InPerson", null));

        var updated = await svc.UpdateStatusAsync(
            created.Id, doctorId,
            new UpdateStatusRequest("Cancelled", "Acil durum"));

        Assert.Equal("Cancelled",  updated.Status);

        var raw = await db.Appointments.FindAsync(created.Id);
        Assert.Equal("Acil durum", raw!.CancellationReason);
    }

    [Fact]
    public async Task UpdateStatus_AlreadyCancelled_ShouldThrow()
    {
        var date = NextMonday();
        var slot = new TimeOnly(10, 0);
        var (_, svc, _, doctorId, patientId) = Setup(date, slot);

        var created = await svc.CreateAsync(patientId,
            new CreateAppointmentRequest(doctorId, date, slot, "InPerson", null));

        await svc.UpdateStatusAsync(created.Id, doctorId, new UpdateStatusRequest("Cancelled", null));

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.UpdateStatusAsync(created.Id, doctorId, new UpdateStatusRequest("Confirmed", null)));
    }

    [Fact]
    public async Task UpdateStatus_UnauthorizedUser_ShouldThrow()
    {
        var date = NextMonday();
        var slot = new TimeOnly(10, 0);
        var (_, svc, _, doctorId, patientId) = Setup(date, slot);

        var created = await svc.CreateAsync(patientId,
            new CreateAppointmentRequest(doctorId, date, slot, "InPerson", null));

        var stranger = Guid.NewGuid();

        await Assert.ThrowsAsync<UnauthorizedAccessException>(
            () => svc.UpdateStatusAsync(created.Id, stranger, new UpdateStatusRequest("Cancelled", null)));
    }

    [Fact]
    public async Task GetByDoctor_ShouldReturnOnlyDoctorAppointments()
    {
        var date = NextMonday();
        var slot = new TimeOnly(10, 0);
        var (_, svc, _, doctorId, patientId) = Setup(date, slot);

        await svc.CreateAsync(patientId, new CreateAppointmentRequest(doctorId, date, slot, "InPerson", null));

        var list = await svc.GetByDoctorAsync(doctorId, date);

        Assert.Single(list);
        Assert.Equal(doctorId, list[0].DoctorId);
    }

    [Fact]
    public async Task GetByPatient_ShouldReturnPatientAppointments()
    {
        var date = NextMonday();
        var slot = new TimeOnly(10, 0);
        var (_, svc, _, doctorId, patientId) = Setup(date, slot);

        await svc.CreateAsync(patientId, new CreateAppointmentRequest(doctorId, date, slot, "InPerson", null));

        var list = await svc.GetByPatientAsync(patientId);

        Assert.Single(list);
        Assert.Equal(patientId, list[0].PatientId);
    }
}
