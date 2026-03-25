namespace MedicaAI.Core.Entities;

public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Email { get; set; } = null!;
    public string PasswordHash { get; set; } = null!;
    public string PhoneNumber { get; set; } = null!;
    public UserRole Role { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Doctor? Doctor { get; set; }
    public ICollection<Appointment> PatientAppointments { get; set; } = new List<Appointment>();
}

public enum UserRole { Patient, Doctor, Staff }
