using BulutKlinik.Core.DTOs.Appointment;

namespace BulutKlinik.Core.Interfaces;

public interface ISlotGeneratorService
{
    Task<AvailableSlotsResponse> GetAvailableSlotsAsync(Guid doctorId, DateOnly date);
}

public interface IAppointmentService
{
    Task<AvailableSlotsResponse> GetAvailableSlotsAsync(Guid doctorId, DateOnly date);
    Task<AppointmentResponse> CreateAsync(Guid patientId, CreateAppointmentRequest req);
    Task<List<AppointmentResponse>> GetByDoctorAsync(Guid doctorId, DateOnly? date);
    Task<List<AppointmentResponse>> GetByPatientAsync(Guid patientId);
    Task<AppointmentResponse> UpdateStatusAsync(Guid appointmentId, Guid requesterId, UpdateStatusRequest req);
}
