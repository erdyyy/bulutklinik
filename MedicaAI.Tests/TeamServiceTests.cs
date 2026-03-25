using MedicaAI.Core.DTOs.Team;
using MedicaAI.Infrastructure.Services;
using MedicaAI.Tests.Helpers;
using Xunit;

namespace MedicaAI.Tests;

public class TeamServiceTests
{
    private static (TeamService svc, Guid doctorId) Setup()
    {
        var db = DbFactory.Create();
        return (new TeamService(db), Guid.NewGuid());
    }

    private static CreateTeamMemberRequest BuildRequest(Guid doctorId) => new(
        doctorId,
        Name:        "Zeynep Asistan",
        Email:       "zeynep@klinik.com",
        Phone:       "05551234567",
        Role:        "Assistant",
        Permissions: new List<string> { "view_patients", "create_appointments" }
    );

    [Fact]
    public async Task Create_ShouldPersistMember()
    {
        var (svc, doctorId) = Setup();

        var dto = await svc.CreateAsync(BuildRequest(doctorId));

        Assert.Equal("Zeynep Asistan", dto.Name);
        Assert.Equal("Assistant",      dto.Role);
        Assert.Equal(2,                dto.Permissions.Count);
        Assert.Contains("view_patients", dto.Permissions);
        Assert.True(dto.IsActive);
    }

    [Fact]
    public async Task Create_InvalidRole_ShouldThrow()
    {
        var (svc, doctorId) = Setup();
        var req = new CreateTeamMemberRequest(doctorId, "Ali", "ali@t.com", "05000000000", "InvalidRole", new List<string>());

        await Assert.ThrowsAsync<ArgumentException>(() => svc.CreateAsync(req));
    }

    [Fact]
    public async Task GetByDoctor_ShouldReturnOnlyDoctorMembers()
    {
        var (svc, doctorId) = Setup();
        var otherDoctor = Guid.NewGuid();

        await svc.CreateAsync(BuildRequest(doctorId));
        await svc.CreateAsync(new CreateTeamMemberRequest(
            otherDoctor, "Başkası", "b@t.com", "05000000001", "Receptionist", new List<string>()));

        var list = (await svc.GetByDoctorAsync(doctorId)).ToList();

        Assert.Single(list);
        Assert.Equal(doctorId, list[0].DoctorId);
    }

    [Fact]
    public async Task Update_ShouldModifyNameAndPermissions()
    {
        var (svc, doctorId) = Setup();
        var dto = await svc.CreateAsync(BuildRequest(doctorId));

        var updated = await svc.UpdateAsync(dto.Id, new UpdateTeamMemberRequest(
            Name: "Zeynep Güncellendi",
            Phone: null,
            Permissions: new List<string> { "view_patients" },
            IsActive: null));

        Assert.Equal("Zeynep Güncellendi", updated.Name);
        Assert.Single(updated.Permissions);
    }

    [Fact]
    public async Task Update_ShouldDeactivateMember()
    {
        var (svc, doctorId) = Setup();
        var dto = await svc.CreateAsync(BuildRequest(doctorId));

        var updated = await svc.UpdateAsync(dto.Id, new UpdateTeamMemberRequest(null, null, null, IsActive: false));

        Assert.False(updated.IsActive);
    }

    [Fact]
    public async Task Delete_ShouldRemoveMember()
    {
        var (svc, doctorId) = Setup();
        var dto = await svc.CreateAsync(BuildRequest(doctorId));

        await svc.DeleteAsync(dto.Id);

        var list = await svc.GetByDoctorAsync(doctorId);
        Assert.Empty(list);
    }

    [Fact]
    public async Task Delete_NonExistent_ShouldThrow()
    {
        var (svc, _) = Setup();

        await Assert.ThrowsAsync<KeyNotFoundException>(() => svc.DeleteAsync(Guid.NewGuid()));
    }

    [Fact]
    public async Task Create_ShouldSerializePermissionsAsJson()
    {
        var (svc, doctorId) = Setup();
        var permissions = new List<string> { "a", "b", "c" };
        var req = new CreateTeamMemberRequest(doctorId, "Ali", "ali@t.com", "05000", "Nurse", permissions);

        var dto = await svc.CreateAsync(req);

        Assert.Equal(permissions.Count, dto.Permissions.Count);
        Assert.Equal(permissions, dto.Permissions);
    }
}
