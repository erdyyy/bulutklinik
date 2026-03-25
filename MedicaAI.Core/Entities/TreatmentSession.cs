namespace MedicaAI.Core.Entities;

public class TreatmentSession
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid PackageId { get; set; }
    public int SessionNumber { get; set; }
    public DateTime? CompletedAt { get; set; }
    public string? Notes { get; set; }

    public TreatmentPackage Package { get; set; } = null!;
}
