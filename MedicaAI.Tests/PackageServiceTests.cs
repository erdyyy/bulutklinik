using MedicaAI.Core.DTOs.Packages;
using MedicaAI.Core.Entities;
using MedicaAI.Infrastructure.Persistence;
using MedicaAI.Infrastructure.Services;
using MedicaAI.Tests.Helpers;
using Xunit;

namespace MedicaAI.Tests;

public class PackageServiceTests
{
    private static (AppDbContext db, PackageService svc, Guid doctorId, Guid patientId) Setup()
    {
        var db = DbFactory.Create();
        var doctorId  = Guid.NewGuid();
        var patientId = Guid.NewGuid();
        db.Users.Add(new User { Id = patientId, Email = "hasta@test.com", PasswordHash = "x", PhoneNumber = "05001112233", Role = UserRole.Patient });
        db.SaveChanges();
        return (db, new PackageService(db), doctorId, patientId);
    }

    [Fact]
    public async Task Create_ShouldPersistPackage()
    {
        var (db, svc, doctorId, patientId) = Setup();

        var req = new CreatePackageRequest(
            doctorId, patientId,
            "Botoks Paketi", "Botoks",
            TotalSessions: 5, PricePerPackage: 1500m,
            IsPaid: false, Notes: null,
            ExpiresAt: DateTime.UtcNow.AddMonths(6));

        var dto = await svc.CreateAsync(req);

        Assert.Equal("Botoks Paketi", dto.PackageName);
        Assert.Equal(5, dto.TotalSessions);
        Assert.Equal(0, dto.CompletedSessions);
        Assert.False(dto.IsPaid);
        Assert.Empty(dto.Sessions);
    }

    [Fact]
    public async Task CompleteSession_ShouldIncrementAndRecordSession()
    {
        var (db, svc, doctorId, patientId) = Setup();

        var pkg = await svc.CreateAsync(new CreatePackageRequest(
            doctorId, patientId, "Paket", "Hizmet", 3, 500m, false, null,
            DateTime.UtcNow.AddMonths(3)));

        var updated = await svc.CompleteSessionAsync(pkg.Id, new CompleteSessionRequest("İlk seans"));

        Assert.Equal(1, updated.CompletedSessions);
        Assert.Single(updated.Sessions);
        Assert.Equal(1, updated.Sessions[0].SessionNumber);
        Assert.Equal("İlk seans", updated.Sessions[0].Notes);
    }

    [Fact]
    public async Task CompleteSession_WhenAllDone_ShouldThrow()
    {
        var (db, svc, doctorId, patientId) = Setup();

        var pkg = await svc.CreateAsync(new CreatePackageRequest(
            doctorId, patientId, "Paket", "Hizmet", 1, 100m, true, null,
            DateTime.UtcNow.AddMonths(1)));

        await svc.CompleteSessionAsync(pkg.Id, new CompleteSessionRequest(null));

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.CompleteSessionAsync(pkg.Id, new CompleteSessionRequest(null)));
    }

    [Fact]
    public async Task GetByDoctor_ShouldReturnOnlyDoctorsPackages()
    {
        var (db, svc, doctorId, patientId) = Setup();
        var otherDoctor = Guid.NewGuid();

        await svc.CreateAsync(new CreatePackageRequest(doctorId, patientId, "P1", "S", 2, 200m, false, null, DateTime.UtcNow.AddMonths(3)));
        await svc.CreateAsync(new CreatePackageRequest(otherDoctor, patientId, "P2", "S", 2, 200m, false, null, DateTime.UtcNow.AddMonths(3)));

        var results = (await svc.GetByDoctorAsync(doctorId)).ToList();

        Assert.Single(results);
        Assert.Equal("P1", results[0].PackageName);
    }

    [Fact]
    public async Task Delete_ShouldSoftDelete()
    {
        var (db, svc, doctorId, patientId) = Setup();

        var pkg = await svc.CreateAsync(new CreatePackageRequest(
            doctorId, patientId, "Paket", "Hizmet", 3, 300m, false, null,
            DateTime.UtcNow.AddMonths(3)));

        await svc.DeleteAsync(pkg.Id);

        var results = await svc.GetByDoctorAsync(doctorId);
        Assert.Empty(results);

        // Hard record still exists in DB with IsDeleted=true
        var raw = db.TreatmentPackages.Find(pkg.Id);
        Assert.NotNull(raw);
        Assert.True(raw!.IsDeleted);
    }

    [Fact]
    public async Task CompleteSession_WithNonExistentId_ShouldThrow()
    {
        var (_, svc, _, _) = Setup();

        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => svc.CompleteSessionAsync(Guid.NewGuid(), new CompleteSessionRequest(null)));
    }
}
