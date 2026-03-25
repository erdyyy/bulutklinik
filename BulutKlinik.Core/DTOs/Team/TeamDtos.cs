namespace BulutKlinik.Core.DTOs.Team;

public record TeamMemberDto(
    Guid Id,
    Guid DoctorId,
    string Name,
    string Email,
    string Phone,
    string Role,
    List<string> Permissions,
    bool IsActive,
    DateTime AddedAt
);

public record CreateTeamMemberRequest(
    Guid DoctorId,
    string Name,
    string Email,
    string Phone,
    string Role,
    List<string> Permissions
);

public record UpdateTeamMemberRequest(
    string? Name,
    string? Phone,
    List<string>? Permissions,
    bool? IsActive
);
