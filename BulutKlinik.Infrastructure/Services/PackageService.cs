using BulutKlinik.Core.DTOs.Packages;
using BulutKlinik.Core.Entities;
using BulutKlinik.Core.Interfaces;
using BulutKlinik.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace BulutKlinik.Infrastructure.Services;

public class PackageService(AppDbContext db) : IPackageService
{
    public async Task<IEnumerable<TreatmentPackageDto>> GetByDoctorAsync(Guid doctorId) =>
        await db.TreatmentPackages
            .Where(p => p.DoctorId == doctorId && !p.IsDeleted)
            .Include(p => p.Patient)
            .Include(p => p.Sessions)
            .OrderByDescending(p => p.SoldAt)
            .Select(p => Map(p))
            .ToListAsync();

    public async Task<IEnumerable<TreatmentPackageDto>> GetByPatientAsync(Guid patientId) =>
        await db.TreatmentPackages
            .Where(p => p.PatientId == patientId && !p.IsDeleted)
            .Include(p => p.Patient)
            .Include(p => p.Sessions)
            .OrderByDescending(p => p.SoldAt)
            .Select(p => Map(p))
            .ToListAsync();

    public async Task<TreatmentPackageDto> GetAsync(Guid id)
    {
        var pkg = await db.TreatmentPackages
            .Include(p => p.Patient)
            .Include(p => p.Sessions)
            .FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted)
            ?? throw new KeyNotFoundException("Paket bulunamadı.");
        return Map(pkg);
    }

    public async Task<TreatmentPackageDto> CreateAsync(CreatePackageRequest req)
    {
        var pkg = new TreatmentPackage
        {
            DoctorId       = req.DoctorId,
            PatientId      = req.PatientId,
            PackageName    = req.PackageName,
            ServiceName    = req.ServiceName,
            TotalSessions  = req.TotalSessions,
            PricePerPackage = req.PricePerPackage,
            IsPaid         = req.IsPaid,
            Notes          = req.Notes,
            ExpiresAt      = DateTime.SpecifyKind(req.ExpiresAt, DateTimeKind.Utc),
        };
        db.TreatmentPackages.Add(pkg);
        await db.SaveChangesAsync();
        return await GetAsync(pkg.Id);
    }

    public async Task<TreatmentPackageDto> CompleteSessionAsync(Guid packageId, CompleteSessionRequest req)
    {
        var pkg = await db.TreatmentPackages
            .Include(p => p.Sessions)
            .FirstOrDefaultAsync(p => p.Id == packageId && !p.IsDeleted)
            ?? throw new KeyNotFoundException("Paket bulunamadı.");

        if (pkg.CompletedSessions >= pkg.TotalSessions)
            throw new InvalidOperationException("Tüm seanslar tamamlandı.");

        pkg.CompletedSessions++;
        var session = new TreatmentSession
        {
            PackageId     = packageId,
            SessionNumber = pkg.CompletedSessions,
            CompletedAt   = DateTime.UtcNow,
            Notes         = req.Notes,
        };
        db.TreatmentSessions.Add(session);
        await db.SaveChangesAsync();
        return await GetAsync(packageId);
    }

    public async Task DeleteAsync(Guid id)
    {
        var pkg = await db.TreatmentPackages.FindAsync(id)
            ?? throw new KeyNotFoundException("Paket bulunamadı.");
        pkg.IsDeleted = true;
        await db.SaveChangesAsync();
    }

    private static TreatmentPackageDto Map(TreatmentPackage p) => new(
        p.Id, p.DoctorId, p.PatientId,
        p.Patient?.Email ?? "",
        p.PackageName, p.ServiceName,
        p.TotalSessions, p.CompletedSessions,
        p.PricePerPackage, p.IsPaid, p.Notes,
        p.SoldAt, p.ExpiresAt,
        p.Sessions
            .OrderBy(s => s.SessionNumber)
            .Select(s => new TreatmentSessionDto(s.Id, s.SessionNumber, s.CompletedAt, s.Notes))
            .ToList()
    );
}
