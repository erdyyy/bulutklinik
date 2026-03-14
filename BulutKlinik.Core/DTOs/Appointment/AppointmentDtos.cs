namespace BulutKlinik.Core.DTOs.Appointment;

public record TimeSlot(
    TimeOnly StartTime,
    TimeOnly EndTime,
    bool IsAvailable
);

public record AvailableSlotsResponse(
    Guid DoctorId,
    DateOnly Date,
    List<TimeSlot> Slots
);

public record CreateAppointmentRequest(
    Guid DoctorId,
    DateOnly AppointmentDate,
    TimeOnly StartTime,
    string Type,
    string? Notes
);

public record AppointmentResponse(
    Guid Id,
    Guid DoctorId,
    string DoctorName,
    Guid PatientId,
    DateOnly AppointmentDate,
    TimeOnly StartTime,
    TimeOnly EndTime,
    string Status,
    string Type,
    string? Notes,
    DateTime CreatedAt
);

public record UpdateStatusRequest(string Status, string? CancellationReason);
