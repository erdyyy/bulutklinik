using System.Text.Json;
using MedicaAI.Core.DTOs.Team;
using MedicaAI.Core.Entities;
using MedicaAI.Core.Interfaces;
using MedicaAI.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MedicaAI.Infrastructure.Services;

public class TeamService(AppDbContext db) : ITeamService
{
    public async Task<IEnumerable<TeamMemberDto>> GetByDoctorAsync(Guid doctorId) =>
        await db.TeamMembers
            .Where(m => m.DoctorId == doctorId)
            .OrderBy(m => m.Name)
            .Select(m => Map(m))
            .ToListAsync();

    public async Task<TeamMemberDto> CreateAsync(CreateTeamMemberRequest req)
    {
        if (!Enum.TryParse<TeamRole>(req.Role, true, out var role))
            throw new ArgumentException($"Geçersiz rol: {req.Role}");

        var member = new TeamMember
        {
            DoctorId        = req.DoctorId,
            Name            = req.Name,
            Email           = req.Email,
            Phone           = req.Phone,
            Role            = role,
            PermissionsJson = JsonSerializer.Serialize(req.Permissions),
        };
        db.TeamMembers.Add(member);
        await db.SaveChangesAsync();
        return Map(member);
    }

    public async Task<TeamMemberDto> UpdateAsync(Guid id, UpdateTeamMemberRequest req)
    {
        var member = await db.TeamMembers.FindAsync(id)
            ?? throw new KeyNotFoundException("Üye bulunamadı.");

        if (req.Name is not null)        member.Name            = req.Name;
        if (req.Phone is not null)       member.Phone           = req.Phone;
        if (req.IsActive is not null)    member.IsActive        = req.IsActive.Value;
        if (req.Permissions is not null) member.PermissionsJson = JsonSerializer.Serialize(req.Permissions);

        await db.SaveChangesAsync();
        return Map(member);
    }

    public async Task DeleteAsync(Guid id)
    {
        var member = await db.TeamMembers.FindAsync(id)
            ?? throw new KeyNotFoundException("Üye bulunamadı.");
        db.TeamMembers.Remove(member);
        await db.SaveChangesAsync();
    }

    private static TeamMemberDto Map(TeamMember m) => new(
        m.Id, m.DoctorId, m.Name, m.Email, m.Phone,
        m.Role.ToString(),
        JsonSerializer.Deserialize<List<string>>(m.PermissionsJson) ?? [],
        m.IsActive, m.AddedAt
    );
}
