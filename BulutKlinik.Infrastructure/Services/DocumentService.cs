using BulutKlinik.Core.DTOs.Documents;
using BulutKlinik.Core.Entities;
using BulutKlinik.Core.Interfaces;
using BulutKlinik.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace BulutKlinik.Infrastructure.Services;

public class DocumentService(AppDbContext db) : IDocumentService
{
    public async Task<DocumentDto> UploadAsync(Guid patientId, UploadDocumentRequest req)
    {
        if (!Enum.TryParse<DocumentCategory>(req.Category, true, out var cat))
            throw new ArgumentException($"Geçersiz kategori: {req.Category}");
        var doc = new Document
        {
            PatientId = patientId, AppointmentId = req.AppointmentId,
            FileName = req.FileName, FileType = req.FileType,
            FileBase64 = req.FileBase64, Category = cat
        };
        db.Documents.Add(doc);
        await db.SaveChangesAsync();
        return Map(doc);
    }

    public async Task<IEnumerable<DocumentDto>> GetByPatientAsync(Guid patientId) =>
        await db.Documents.Where(d => d.PatientId == patientId && !d.IsDeleted)
            .OrderByDescending(d => d.UploadedAt).Select(d => Map(d)).ToListAsync();

    public async Task<DocumentDto> GetByIdAsync(Guid id)
    {
        var doc = await db.Documents.FirstOrDefaultAsync(d => d.Id == id && !d.IsDeleted)
            ?? throw new KeyNotFoundException("Doküman bulunamadı.");
        return Map(doc);
    }

    private static DocumentDto Map(Document d) => new(
        d.Id, d.PatientId, d.AppointmentId, d.FileName, d.FileType, d.Category.ToString(), d.UploadedAt);
}
