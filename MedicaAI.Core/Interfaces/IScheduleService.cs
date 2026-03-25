using MedicaAI.Core.DTOs.Schedule;

namespace MedicaAI.Core.Interfaces;

public interface IScheduleService
{
    Task<List<WorkingScheduleResponse>> GetSchedulesAsync(Guid doctorId);
    Task<WorkingScheduleResponse> UpsertScheduleAsync(Guid doctorId, WorkingScheduleRequest req);
    Task DeleteScheduleAsync(Guid doctorId, Guid scheduleId);

    Task<List<DoctorLeaveResponse>> GetLeavesAsync(Guid doctorId);
    Task<DoctorLeaveResponse> AddLeaveAsync(Guid doctorId, DoctorLeaveRequest req);
    Task DeleteLeaveAsync(Guid doctorId, Guid leaveId);
}
