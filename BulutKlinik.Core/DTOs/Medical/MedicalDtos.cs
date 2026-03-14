using BulutKlinik.Core.Entities;

namespace BulutKlinik.Core.DTOs.Medical;

// PatientHistory
public record PatientHistoryRequest(
    string? ChronicDiseases,
    string? Allergies,
    string? FamilyHistory,
    string? PreviousSurgeries,
    string? CurrentMedications,
    string? BloodType
);

public record PatientHistoryResponse(
    Guid Id,
    Guid PatientId,
    string? ChronicDiseases,
    string? Allergies,
    string? FamilyHistory,
    string? PreviousSurgeries,
    string? CurrentMedications,
    string? BloodType,
    DateTime UpdatedAt
);

// MedicalRecord
public record CreateMedicalRecordRequest(
    Guid? AppointmentId,
    string ChiefComplaint,
    string? Findings,
    string? Diagnosis,
    string? TreatmentPlan,
    string? IcdCode
);

public record MedicalRecordResponse(
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

// Measurement
public record CreateMeasurementRequest(
    MeasurementType Type,
    string Value,
    string Unit,
    DateTime? MeasuredAt
);

public record MeasurementResponse(
    Guid Id,
    Guid PatientId,
    MeasurementType Type,
    string Value,
    string Unit,
    DateTime MeasuredAt
);
