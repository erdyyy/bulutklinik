using MedicaAI.Core.DTOs.Documents;
using MedicaAI.Core.Entities;
using MedicaAI.Core.Interfaces;
using MedicaAI.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MedicaAI.Infrastructure.Services;

public class DocumentService(AppDbContext db) : IDocumentService
{
    private const string UploadsRoot = "/app/uploads";

    public async Task<DocumentDto> UploadAsync(Guid patientId, UploadDocumentRequest req)
    {
        if (!Enum.TryParse<DocumentCategory>(req.Category, true, out var cat))
            throw new ArgumentException($"Geçersiz kategori: {req.Category}");

        var bytes    = Convert.FromBase64String(req.FileBase64);
        var ext      = Path.GetExtension(req.FileName);
        var dir      = Path.Combine(UploadsRoot, patientId.ToString());
        Directory.CreateDirectory(dir);
        var filePath = Path.Combine(dir, $"{Guid.NewGuid()}{ext}");
        await File.WriteAllBytesAsync(filePath, bytes);

        var doc = new Document
        {
            PatientId     = patientId,
            AppointmentId = req.AppointmentId,
            FileName      = req.FileName,
            FileType      = req.FileType,
            FilePath      = filePath,
            Category      = cat
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

    public async Task<FileDownloadResult> DownloadFileAsync(Guid id)
    {
        var doc = await db.Documents.FirstOrDefaultAsync(d => d.Id == id && !d.IsDeleted)
            ?? throw new KeyNotFoundException("Doküman bulunamadı.");

        if (string.IsNullOrEmpty(doc.FilePath) || !File.Exists(doc.FilePath))
            throw new FileNotFoundException("Dosya bulunamadı.");

        var bytes = await File.ReadAllBytesAsync(doc.FilePath);
        return new FileDownloadResult(bytes, doc.FileType, doc.FileName);
    }

    private static DocumentDto Map(Document d) => new(
        d.Id, d.PatientId, d.AppointmentId, d.FileName, d.FileType, d.Category.ToString(), d.UploadedAt);
}
