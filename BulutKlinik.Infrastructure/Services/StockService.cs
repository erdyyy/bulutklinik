using BulutKlinik.Core.DTOs.Stock;
using BulutKlinik.Core.Entities;
using BulutKlinik.Core.Interfaces;
using BulutKlinik.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace BulutKlinik.Infrastructure.Services;

public class StockService(AppDbContext db) : IStockService
{
    // ── Dokümanlar ────────────────────────────────────────────────

    public async Task<DocumentResponse> UploadDocumentAsync(Guid patientId, CreateDocumentRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.FileName))
            throw new ArgumentException("Dosya adı boş olamaz.");
        if (string.IsNullOrWhiteSpace(request.FileBase64))
            throw new ArgumentException("Dosya içeriği boş olamaz.");

        var doc = new Document
        {
            PatientId     = patientId,
            AppointmentId = request.AppointmentId,
            FileName      = request.FileName,
            FileType      = request.FileType,
            FileBase64    = request.FileBase64,
            Category      = request.Category
        };
        db.Documents.Add(doc);
        await db.SaveChangesAsync();
        return ToResponse(doc);
    }

    public async Task<List<DocumentResponse>> GetDocumentsAsync(Guid patientId)
    {
        var docs = await db.Documents
            .Where(d => d.PatientId == patientId)
            .OrderByDescending(d => d.UploadedAt)
            .ToListAsync();
        return docs.Select(ToResponse).ToList();
    }

    public async Task<DocumentDownloadResponse> DownloadDocumentAsync(Guid documentId)
    {
        var doc = await db.Documents.FindAsync(documentId)
            ?? throw new KeyNotFoundException("Doküman bulunamadı.");
        return new DocumentDownloadResponse(doc.Id, doc.FileName, doc.FileType, doc.FileBase64);
    }

    // ── Stok ──────────────────────────────────────────────────────

    public async Task<List<StockItemResponse>> GetStockAsync()
    {
        var items = await db.StockItems
            .OrderBy(s => s.Name)
            .ToListAsync();
        return items.Select(ToResponse).ToList();
    }

    public async Task<StockItemResponse> CreateStockItemAsync(StockItemRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            throw new ArgumentException("Stok adı boş olamaz.");

        var item = new StockItem
        {
            Name            = request.Name,
            Category        = request.Category,
            Unit            = request.Unit,
            MinimumQuantity = request.MinimumQuantity,
            ExpiryDate      = request.ExpiryDate,
            UnitCost        = request.UnitCost
        };
        db.StockItems.Add(item);
        await db.SaveChangesAsync();
        return ToResponse(item);
    }

    public async Task<StockMovementResponse> AddMovementAsync(Guid stockItemId, StockMovementRequest request)
    {
        var item = await db.StockItems.FindAsync(stockItemId)
            ?? throw new KeyNotFoundException("Stok kalemi bulunamadı.");

        if (request.Quantity <= 0)
            throw new ArgumentException("Miktar sıfırdan büyük olmalıdır.");

        // Stok güncellemesi
        item.CurrentQuantity += request.Type is StockMovementType.In or StockMovementType.Return
            ? request.Quantity
            : -request.Quantity;

        if (item.CurrentQuantity < 0)
            throw new InvalidOperationException("Yetersiz stok.");

        var movement = new StockMovement
        {
            StockItemId = stockItemId,
            Type        = request.Type,
            Quantity    = request.Quantity,
            Note        = request.Note
        };
        db.StockMovements.Add(movement);
        await db.SaveChangesAsync();

        return new StockMovementResponse(
            movement.Id, movement.StockItemId, item.Name,
            movement.Type, movement.Quantity, movement.Note, movement.MovedAt);
    }

    public async Task<List<StockItemResponse>> GetLowStockAsync()
    {
        var items = await db.StockItems
            .Where(s => s.CurrentQuantity <= s.MinimumQuantity)
            .OrderBy(s => s.Name)
            .ToListAsync();
        return items.Select(ToResponse).ToList();
    }

    // ── Mappers ───────────────────────────────────────────────────
    private static DocumentResponse ToResponse(Document d) => new(
        d.Id, d.PatientId, d.AppointmentId, d.FileName, d.FileType, d.Category, d.UploadedAt);

    private static StockItemResponse ToResponse(StockItem s) => new(
        s.Id, s.Name, s.Category, s.Unit,
        s.CurrentQuantity, s.MinimumQuantity,
        s.ExpiryDate, s.UnitCost,
        s.CurrentQuantity <= s.MinimumQuantity,
        s.IsActive);
}
