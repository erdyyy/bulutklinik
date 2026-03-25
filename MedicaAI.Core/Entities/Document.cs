namespace MedicaAI.Core.Entities;

public class Document
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid PatientId { get; set; }
    public Guid? AppointmentId { get; set; }
    public string FileName { get; set; } = null!;
    public string FileType { get; set; } = null!;
    public string FilePath { get; set; } = string.Empty;;
    public DocumentCategory Category { get; set; }
    public bool IsDeleted { get; set; } = false;
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;

    public User Patient { get; set; } = null!;
    public Appointment? Appointment { get; set; }
}

public enum DocumentCategory { LabResult, Prescription, Consent, Other }
