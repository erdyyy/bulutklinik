using BulutKlinik.Core.DTOs.Appointment;
using BulutKlinik.Core.Entities;
using BulutKlinik.Core.Interfaces;
using BulutKlinik.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace BulutKlinik.Infrastructure.Services;

public class AppointmentService(AppDbContext db, ISlotGeneratorService slotGenerator) : IAppointmentService
{
    public Task<AvailableSlotsResponse> GetAvailableSlotsAsync(Guid doctorId, DateOnly date)
        => slotGenerator.GetAvailableSlotsAsync(doctorId, date);

    public async Task<AppointmentResponse> CreateAsync(Guid patientId, CreateAppointmentRequest req)
    {
        if (!Enum.TryParse<AppointmentType>(req.Type, ignoreCase: true, out var apptType))
            throw new ArgumentException($"Geçersiz randevu tipi: {req.Type}");

        // Transaction ile race condition önlemi
        await using var tx = await db.Database.BeginTransactionAsync();
        try
        {
            // Slot müsait mi? (gerçek zamanlı kontrol)
            var slotsResponse = await slotGenerator.GetAvailableSlotsAsync(req.DoctorId, req.AppointmentDate);
            var slot = slotsResponse.Slots.FirstOrDefault(s => s.StartTime == req.StartTime);

            if (slot is null || !slot.IsAvailable)
                throw new InvalidOperationException("Seçilen saat müsait değil veya geçersiz.");

            // Çalışma takviminden süreyi al
            var schedule = await db.WorkingSchedules
                .FirstOrDefaultAsync(w =>
                    w.DoctorId == req.DoctorId &&
                    w.DayOfWeek == req.AppointmentDate.DayOfWeek &&
                    w.IsActive)
                ?? throw new InvalidOperationException("Doktor bu gün çalışma takvimi tanımlamamış.");

            var appointment = new Appointment
            {
                DoctorId        = req.DoctorId,
                PatientId       = patientId,
                AppointmentDate = req.AppointmentDate,
                StartTime       = req.StartTime,
                EndTime         = req.StartTime.AddMinutes(schedule.AppointmentDurationMinutes),
                Type            = apptType,
                Notes           = req.Notes,
                Status          = AppointmentStatus.Confirmed
            };

            db.Appointments.Add(appointment);
            await db.SaveChangesAsync();
            await tx.CommitAsync();

            // Navigation property'leri yükle
            await db.Entry(appointment).Reference(a => a.Doctor).LoadAsync();
            await db.Entry(appointment).Reference(a => a.Patient).LoadAsync();

            return ToResponse(appointment);
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }
    }

    public async Task<List<AppointmentResponse>> GetByDoctorAsync(Guid doctorId, DateOnly? date)
    {
        var query = db.Appointments
            .Include(a => a.Doctor)
            .Include(a => a.Patient)
            .Where(a => a.DoctorId == doctorId);

        if (date.HasValue)
            query = query.Where(a => a.AppointmentDate == date.Value);

        var list = await query
            .OrderBy(a => a.AppointmentDate)
            .ThenBy(a => a.StartTime)
            .ToListAsync();

        return list.Select(ToResponse).ToList();
    }

    public async Task<List<AppointmentResponse>> GetByPatientAsync(Guid patientId)
    {
        var list = await db.Appointments
            .Include(a => a.Doctor)
            .Include(a => a.Patient)
            .Where(a => a.PatientId == patientId)
            .OrderByDescending(a => a.AppointmentDate)
            .ThenBy(a => a.StartTime)
            .ToListAsync();

        return list.Select(ToResponse).ToList();
    }

    public async Task<AppointmentResponse> UpdateStatusAsync(
        Guid appointmentId, Guid requesterId, UpdateStatusRequest req)
    {
        if (!Enum.TryParse<AppointmentStatus>(req.Status, ignoreCase: true, out var newStatus))
            throw new ArgumentException($"Geçersiz durum: {req.Status}");

        var appointment = await db.Appointments
            .Include(a => a.Doctor)
            .Include(a => a.Patient)
            .FirstOrDefaultAsync(a => a.Id == appointmentId)
            ?? throw new KeyNotFoundException("Randevu bulunamadı.");

        // Sadece ilgili doktor veya hasta güncelleme yapabilir
        if (appointment.DoctorId != requesterId && appointment.PatientId != requesterId)
            throw new UnauthorizedAccessException("Bu randevuyu güncelleme yetkiniz bulunmuyor.");

        // Tamamlanmış veya iptal edilmiş randevu tekrar güncellenemez
        if (appointment.Status is AppointmentStatus.Completed or AppointmentStatus.Cancelled)
            throw new InvalidOperationException($"'{appointment.Status}' durumundaki randevu güncellenemez.");

        appointment.Status             = newStatus;
        appointment.CancellationReason = newStatus == AppointmentStatus.Cancelled
            ? req.CancellationReason
            : null;
        appointment.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();
        return ToResponse(appointment);
    }

    // ── Helper ───────────────────────────────────────────────────
    private static AppointmentResponse ToResponse(Appointment a) => new(
        a.Id,
        a.DoctorId,
        a.Doctor?.FullName ?? string.Empty,
        a.PatientId,
        a.AppointmentDate,
        a.StartTime,
        a.EndTime,
        a.Status.ToString(),
        a.Type.ToString(),
        a.Notes,
        a.CreatedAt);
}
