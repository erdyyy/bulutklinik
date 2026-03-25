namespace MedicaAI.Core.Entities;

public class DoctorLeave
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid DoctorId { get; set; }
    public DateOnly LeaveDate { get; set; }
    public bool IsFullDay { get; set; } = true;
    public TimeOnly? StartTime { get; set; }
    public TimeOnly? EndTime { get; set; }
    public string? Reason { get; set; }

    public Doctor Doctor { get; set; } = null!;
}
