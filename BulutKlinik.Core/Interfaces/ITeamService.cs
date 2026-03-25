using BulutKlinik.Core.DTOs.Team;

namespace BulutKlinik.Core.Interfaces;

public interface ITeamService
{
    Task<IEnumerable<TeamMemberDto>> GetByDoctorAsync(Guid doctorId);
    Task<TeamMemberDto> CreateAsync(CreateTeamMemberRequest req);
    Task<TeamMemberDto> UpdateAsync(Guid id, UpdateTeamMemberRequest req);
    Task DeleteAsync(Guid id);
}
