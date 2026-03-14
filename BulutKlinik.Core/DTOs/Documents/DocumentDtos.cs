namespace BulutKlinik.Core.DTOs.Documents;

public record DocumentDto(
    Guid Id, Guid PatientId, Guid? AppointmentId,
    string FileName, string FileType, string Category, DateTime UploadedAt
);
public record UploadDocumentRequest(
    Guid? AppointmentId, string FileName, string FileType, string FileBase64, string Category
);
