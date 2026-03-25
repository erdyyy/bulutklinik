using MedicaAI.Core.DTOs.Schedule;
using MedicaAI.Core.Entities;
using MedicaAI.Core.Interfaces;
using MedicaAI.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MedicaAI.Infrastructure.Services;

public class ScheduleService(AppDbContext db) : IScheduleService
{
    // ── Working Schedules ─────────────────────────────────────────

    public async Task<List<WorkingScheduleResponse>> GetSchedulesAsync(Guid doctorId)
    {
        return await db.WorkingSchedules
            .Where(w => w.DoctorId == doctorId && w.IsActive)
            .OrderBy(w => w.DayOfWeek)
            .Select(w => new WorkingScheduleResponse(
                w.Id,
                w.DayOfWeek.ToString(),
                w.StartTime,
                w.EndTime,
                w.AppointmentDurationMinutes,
                w.IsActive))
            .ToListAsync();
    }

    public async Task<WorkingScheduleResponse> UpsertScheduleAsync(Guid doctorId, WorkingScheduleRequest req)
    {
        if (!Enum.TryParse<DayOfWeek>(req.DayOfWeek, ignoreCase: true, out var day))
            throw new ArgumentException($"Geçersiz gün: {req.DayOfWeek}");

        if (req.StartTime >= req.EndTime)
            throw new ArgumentException("Başlangıç saati bitiş saatinden önce olmalıdır.");

        if (req.AppointmentDurationMinutes < 5 || req.AppointmentDurationMinutes > 120)
            throw new ArgumentException("Randevu süresi 5-120 dakika arasında olmalıdır.");

        var existing = await db.WorkingSchedules
            .FirstOrDefaultAsync(w => w.DoctorId == doctorId && w.DayOfWeek == day);

        if (existing is not null)
        {
            existing.StartTime                  = req.StartTime;
            existing.EndTime                    = req.EndTime;
            existing.AppointmentDurationMinutes = req.AppointmentDurationMinutes;
            existing.IsActive                   = true;
        }
        else
        {
            existing = new WorkingSchedule
            {
                DoctorId                    = doctorId,
                DayOfWeek                   = day,
                StartTime                   = req.StartTime,
                EndTime                     = req.EndTime,
                AppointmentDurationMinutes  = req.AppointmentDurationMinutes
            };
            db.WorkingSchedules.Add(existing);
        }

        await db.SaveChangesAsync();

        return new WorkingScheduleResponse(
            existing.Id,
            existing.DayOfWeek.ToString(),
            existing.StartTime,
            existing.EndTime,
            existing.AppointmentDurationMinutes,
            existing.IsActive);
    }

    public async Task DeleteScheduleAsync(Guid doctorId, Guid scheduleId)
    {
        var schedule = await db.WorkingSchedules
            .FirstOrDefaultAsync(w => w.Id == scheduleId && w.DoctorId == doctorId)
            ?? throw new KeyNotFoundException("Çalışma takvimi bulunamadı.");

        schedule.IsActive = false; // soft delete
        await db.SaveChangesAsync();
    }

    // ── Doctor Leaves ─────────────────────────────────────────────

    public async Task<List<DoctorLeaveResponse>> GetLeavesAsync(Guid doctorId)
    {
        var today = DateOnly.FromDateTime(DateTime.Today);

        return await db.DoctorLeaves
            .Where(l => l.DoctorId == doctorId && l.LeaveDate >= today)
            .OrderBy(l => l.LeaveDate)
            .Select(l => new DoctorLeaveResponse(
                l.Id,
                l.LeaveDate,
                l.IsFullDay,
                l.StartTime,
                l.EndTime,
                l.Reason))
            .ToListAsync();
    }

    public async Task<DoctorLeaveResponse> AddLeaveAsync(Guid doctorId, DoctorLeaveRequest req)
    {
        // Tam gün izin çakışması kontrolü
        if (req.IsFullDay)
        {
            var exists = await db.DoctorLeaves.AnyAsync(l =>
                l.DoctorId == doctorId &&
                l.LeaveDate == req.LeaveDate &&
                l.IsFullDay);

            if (exists)
                throw new InvalidOperationException("Bu tarihe zaten tam gün izin tanımlanmış.");
        }

        // Yarım gün izin: start/end zorunlu
        if (!req.IsFullDay && (req.StartTime is null || req.EndTime is null))
            throw new ArgumentException("Yarım gün izin için başlangıç ve bitiş saati zorunludur.");

        var leave = new DoctorLeave
        {
            DoctorId  = doctorId,
            LeaveDate = req.LeaveDate,
            IsFullDay = req.IsFullDay,
            StartTime = req.StartTime,
            EndTime   = req.EndTime,
            Reason    = req.Reason
        };

        db.DoctorLeaves.Add(leave);
        await db.SaveChangesAsync();

        return new DoctorLeaveResponse(
            leave.Id,
            leave.LeaveDate,
            leave.IsFullDay,
            leave.StartTime,
            leave.EndTime,
            leave.Reason);
    }

    public async Task DeleteLeaveAsync(Guid doctorId, Guid leaveId)
    {
        var leave = await db.DoctorLeaves
            .FirstOrDefaultAsync(l => l.Id == leaveId && l.DoctorId == doctorId)
            ?? throw new KeyNotFoundException("İzin kaydı bulunamadı.");

        db.DoctorLeaves.Remove(leave);
        await db.SaveChangesAsync();
    }
}
