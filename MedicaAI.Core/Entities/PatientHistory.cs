namespace MedicaAI.Core.Entities;

public class PatientHistory
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid PatientId { get; set; }
    public string? ChronicDiseases { get; set; }
    public string? Allergies { get; set; }
    public string? FamilyHistory { get; set; }
    public string? PreviousSurgeries { get; set; }
    public string? CurrentMedications { get; set; }
    public string? BloodType { get; set; }
    public bool IsDeleted { get; set; } = false;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public User Patient { get; set; } = null!;
}
