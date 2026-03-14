using BulutKlinik.Core.DTOs.Medical;

namespace BulutKlinik.Core.Interfaces;

public interface IMedicalService
{
    Task<PatientHistoryDto> GetHistoryAsync(Guid patientId);
    Task<PatientHistoryDto> UpsertHistoryAsync(Guid patientId, UpsertHistoryRequest req);
    Task<MedicalRecordDto> CreateRecordAsync(Guid appointmentId, CreateMedicalRecordRequest req);
    Task<IEnumerable<MedicalRecordDto>> GetRecordsAsync(Guid patientId);
    Task<MeasurementDto> CreateMeasurementAsync(Guid patientId, CreateMeasurementRequest req);
    Task<IEnumerable<MeasurementDto>> GetMeasurementsAsync(Guid patientId, string? type);
}
