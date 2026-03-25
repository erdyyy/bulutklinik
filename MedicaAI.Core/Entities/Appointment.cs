namespace MedicaAI.Core.Entities;

public class Appointment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid DoctorId { get; set; }
    public Guid PatientId { get; set; }
    public DateOnly AppointmentDate { get; set; }
    public TimeOnly StartTime { get; set; }
    public TimeOnly EndTime { get; set; }
    public AppointmentStatus Status { get; set; } = AppointmentStatus.Pending;
    public AppointmentType Type { get; set; } = AppointmentType.InPerson;
    public string? Notes { get; set; }
    public string? CancellationReason { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public Doctor Doctor { get; set; } = null!;
    public User Patient { get; set; } = null!;
}

public enum AppointmentStatus { Pending, Confirmed, Cancelled, Completed, NoShow }
public enum AppointmentType { InPerson, Online }
