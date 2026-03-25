namespace MedicaAI.Core.DTOs.Packages;

public record TreatmentSessionDto(Guid Id, int SessionNumber, DateTime? CompletedAt, string? Notes);

public record TreatmentPackageDto(
    Guid Id,
    Guid DoctorId,
    Guid PatientId,
    string PatientName,
    string PackageName,
    string ServiceName,
    int TotalSessions,
    int CompletedSessions,
    decimal PricePerPackage,
    bool IsPaid,
    string? Notes,
    DateTime SoldAt,
    DateTime ExpiresAt,
    List<TreatmentSessionDto> Sessions
);

public record CreatePackageRequest(
    Guid DoctorId,
    Guid PatientId,
    string PackageName,
    string ServiceName,
    int TotalSessions,
    decimal PricePerPackage,
    bool IsPaid,
    string? Notes,
    DateTime ExpiresAt
);

public record CompleteSessionRequest(string? Notes);
