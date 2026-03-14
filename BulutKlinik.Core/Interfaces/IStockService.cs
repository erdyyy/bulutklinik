using BulutKlinik.Core.DTOs.Stock;
using BulutKlinik.Core.Entities;

namespace BulutKlinik.Core.Interfaces;

public interface IStockService
{
    Task<DocumentResponse> UploadDocumentAsync(Guid patientId, CreateDocumentRequest request);
    Task<List<DocumentResponse>> GetDocumentsAsync(Guid patientId);
    Task<DocumentDownloadResponse> DownloadDocumentAsync(Guid documentId);

    Task<List<StockItemResponse>> GetStockAsync();
    Task<StockItemResponse> CreateStockItemAsync(StockItemRequest request);
    Task<StockMovementResponse> AddMovementAsync(Guid stockItemId, StockMovementRequest request);
    Task<List<StockItemResponse>> GetLowStockAsync();
}
