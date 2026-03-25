namespace BulutKlinik.Core.DTOs.Consent;

public record ConsentRecordDto(
    Guid Id,
    Guid DoctorId,
    Guid PatientId,
    string PatientName,
    string PatientPhone,
    string TreatmentType,
    string ConsentText,
    bool KvkkAccepted,
    bool MedicalAccepted,
    bool DisclaimerRead,
    string DoctorName,
    DateTime SignedAt
);

public record CreateConsentRequest(
    Guid DoctorId,
    Guid PatientId,
    string PatientName,
    string PatientPhone,
    string TreatmentType,
    string ConsentText,
    bool KvkkAccepted,
    bool MedicalAccepted,
    bool DisclaimerRead,
    string DoctorName
);
