namespace MedicaAI.Core.Entities;

public class TreatmentPackage
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid DoctorId { get; set; }
    public Guid PatientId { get; set; }
    public string PackageName { get; set; } = null!;
    public string ServiceName { get; set; } = null!;
    public int TotalSessions { get; set; }
    public int CompletedSessions { get; set; } = 0;
    public decimal PricePerPackage { get; set; }
    public bool IsPaid { get; set; } = false;
    public string? Notes { get; set; }
    public DateTime SoldAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; }
    public bool IsDeleted { get; set; } = false;

    public User Patient { get; set; } = null!;
    public Doctor Doctor { get; set; } = null!;
    public ICollection<TreatmentSession> Sessions { get; set; } = new List<TreatmentSession>();
}
