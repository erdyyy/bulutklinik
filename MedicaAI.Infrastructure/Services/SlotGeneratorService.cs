using MedicaAI.Core.DTOs.Appointment;
using MedicaAI.Core.Entities;
using MedicaAI.Core.Interfaces;
using MedicaAI.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MedicaAI.Infrastructure.Services;

public class SlotGeneratorService(AppDbContext db) : ISlotGeneratorService
{
    public async Task<AvailableSlotsResponse> GetAvailableSlotsAsync(Guid doctorId, DateOnly date)
    {
        // 1. O gün için çalışma takvimi var mı?
        var schedule = await db.WorkingSchedules
            .FirstOrDefaultAsync(w =>
                w.DoctorId == doctorId &&
                w.DayOfWeek == date.DayOfWeek &&
                w.IsActive);

        if (schedule is null)
            return new AvailableSlotsResponse(doctorId, date, new List<TimeSlot>());

        // 2. O gün izin var mı?
        var leave = await db.DoctorLeaves
            .FirstOrDefaultAsync(l => l.DoctorId == doctorId && l.LeaveDate == date);

        if (leave is { IsFullDay: true })
            return new AvailableSlotsResponse(doctorId, date, new List<TimeSlot>());

        // 3. O güne ait aktif randevuları çek
        var bookedStartTimes = await db.Appointments
            .Where(a =>
                a.DoctorId == doctorId &&
                a.AppointmentDate == date &&
                a.Status != AppointmentStatus.Cancelled)
            .Select(a => a.StartTime)
            .ToListAsync();

        // 4. Slotları üret
        var slots = GenerateSlots(
            schedule.StartTime,
            schedule.EndTime,
            schedule.AppointmentDurationMinutes,
            bookedStartTimes,
            leave);

        return new AvailableSlotsResponse(doctorId, date, slots);
    }

    private static List<TimeSlot> GenerateSlots(
        TimeOnly start,
        TimeOnly end,
        int durationMinutes,
        List<TimeOnly> bookedStartTimes,
        DoctorLeave? leave)
    {
        var slots   = new List<TimeSlot>();
        var current = start;

        while (current.AddMinutes(durationMinutes) <= end)
        {
            var slotEnd = current.AddMinutes(durationMinutes);

            // Yarım gün izin çakışıyor mu?
            var blockedByLeave = leave is { IsFullDay: false }
                && leave.StartTime.HasValue
                && leave.EndTime.HasValue
                && current >= leave.StartTime.Value
                && current < leave.EndTime.Value;

            // Dolu mu?
            var isBooked = bookedStartTimes.Contains(current);

            slots.Add(new TimeSlot(current, slotEnd, !isBooked && !blockedByLeave));
            current = slotEnd;
        }

        return slots;
    }
}
