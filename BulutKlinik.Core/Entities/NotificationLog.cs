namespace BulutKlinik.Core.Entities;

public class NotificationLog
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid PatientId { get; set; }
    public Guid? AppointmentId { get; set; }
    public NotificationChannel Channel { get; set; }
    public string Message { get; set; } = null!;
    public bool IsSuccess { get; set; } = true;
    public DateTime SentAt { get; set; } = DateTime.UtcNow;

    public User Patient { get; set; } = null!;
    public Appointment? Appointment { get; set; }
}

public enum NotificationChannel { SMS, Email }
