namespace BulutKlinik.Core.DTOs.Medical;

public record PatientHistoryDto(
    Guid PatientId,
    string? ChronicDiseases,
    string? Allergies,
    string? FamilyHistory,
    string? PreviousSurgeries,
    string? CurrentMedications,
    string? BloodType
);

public record UpsertHistoryRequest(
    string? ChronicDiseases,
    string? Allergies,
    string? FamilyHistory,
    string? PreviousSurgeries,
    string? CurrentMedications,
    string? BloodType
);

public record MedicalRecordDto(
    Guid Id,
    Guid PatientId,
    Guid DoctorId,
    string DoctorName,
    Guid? AppointmentId,
    string ChiefComplaint,
    string? Findings,
    string? Diagnosis,
    string? TreatmentPlan,
    string? IcdCode,
    DateTime CreatedAt
);

public record CreateMedicalRecordRequest(
    Guid DoctorId,
    string ChiefComplaint,
    string? Findings,
    string? Diagnosis,
    string? TreatmentPlan,
    string? IcdCode
);

public record MeasurementDto(
    Guid Id,
    Guid PatientId,
    string Type,
    string Value,
    string Unit,
    DateTime MeasuredAt
);

public record CreateMeasurementRequest(
    string Type,
    string Value,
    string Unit,
    DateTime? MeasuredAt
);
