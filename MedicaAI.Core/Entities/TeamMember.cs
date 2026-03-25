namespace MedicaAI.Core.Entities;

public class TeamMember
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid DoctorId { get; set; }      // klinik sahibi doktor
    public string Name { get; set; } = null!;
    public string Email { get; set; } = null!;
    public string Phone { get; set; } = null!;
    public TeamRole Role { get; set; }
    public string PermissionsJson { get; set; } = "[]";  // JSON array of permission keys
    public bool IsActive { get; set; } = true;
    public DateTime AddedAt { get; set; } = DateTime.UtcNow;

    public Doctor Doctor { get; set; } = null!;
}

public enum TeamRole { Assistant, Receptionist, Nurse }
