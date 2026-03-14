namespace BulutKlinik.Core.DTOs.Schedule;

public record WorkingScheduleRequest(
    string DayOfWeek,
    TimeOnly StartTime,
    TimeOnly EndTime,
    int AppointmentDurationMinutes
);

public record WorkingScheduleResponse(
    Guid Id,
    string DayOfWeek,
    TimeOnly StartTime,
    TimeOnly EndTime,
    int AppointmentDurationMinutes,
    bool IsActive
);

public record DoctorLeaveRequest(
    DateOnly LeaveDate,
    bool IsFullDay,
    TimeOnly? StartTime,
    TimeOnly? EndTime,
    string? Reason
);

public record DoctorLeaveResponse(
    Guid Id,
    DateOnly LeaveDate,
    bool IsFullDay,
    TimeOnly? StartTime,
    TimeOnly? EndTime,
    string? Reason
);
