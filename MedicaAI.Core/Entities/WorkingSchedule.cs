namespace MedicaAI.Core.Entities;

public class WorkingSchedule
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid DoctorId { get; set; }
    public DayOfWeek DayOfWeek { get; set; }
    public TimeOnly StartTime { get; set; }
    public TimeOnly EndTime { get; set; }
    public int AppointmentDurationMinutes { get; set; } = 15;
    public bool IsActive { get; set; } = true;

    public Doctor Doctor { get; set; } = null!;
}
