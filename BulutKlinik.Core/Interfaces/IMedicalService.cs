using BulutKlinik.Core.DTOs.Medical;
using BulutKlinik.Core.Entities;

namespace BulutKlinik.Core.Interfaces;

public interface IMedicalService
{
    Task<PatientHistoryResponse> UpsertHistoryAsync(Guid patientId, PatientHistoryRequest request);
    Task<PatientHistoryResponse?> GetHistoryAsync(Guid patientId);

    Task<MedicalRecordResponse> CreateMedicalRecordAsync(Guid patientId, Guid doctorId, Guid appointmentId, CreateMedicalRecordRequest request);
    Task<List<MedicalRecordResponse>> GetMedicalRecordsAsync(Guid patientId);

    Task<MeasurementResponse> AddMeasurementAsync(Guid patientId, CreateMeasurementRequest request);
    Task<List<MeasurementResponse>> GetMeasurementsAsync(Guid patientId, MeasurementType? type);
}
