namespace BulutKlinik.Core.Entities;

public class ConsentRecord
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid DoctorId { get; set; }
    public Guid PatientId { get; set; }
    public string PatientName { get; set; } = null!;
    public string PatientPhone { get; set; } = null!;
    public string TreatmentType { get; set; } = null!;
    public string ConsentText { get; set; } = null!;
    public bool KvkkAccepted { get; set; }
    public bool MedicalAccepted { get; set; }
    public bool DisclaimerRead { get; set; }
    public string DoctorName { get; set; } = null!;
    public DateTime SignedAt { get; set; } = DateTime.UtcNow;

    public Doctor Doctor { get; set; } = null!;
}
