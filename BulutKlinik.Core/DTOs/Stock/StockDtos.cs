using BulutKlinik.Core.Entities;

namespace BulutKlinik.Core.DTOs.Stock;

public record CreateDocumentRequest(
    Guid? AppointmentId,
    string FileName,
    string FileType,
    string FileBase64,
    DocumentCategory Category
);

public record DocumentResponse(
    Guid Id,
    Guid PatientId,
    Guid? AppointmentId,
    string FileName,
    string FileType,
    DocumentCategory Category,
    DateTime UploadedAt
);

public record DocumentDownloadResponse(
    Guid Id,
    string FileName,
    string FileType,
    string FileBase64
);

public record StockItemRequest(
    string Name,
    string? Category,
    string Unit,
    decimal MinimumQuantity,
    DateTime? ExpiryDate,
    decimal UnitCost
);

public record StockItemResponse(
    Guid Id,
    string Name,
    string? Category,
    string Unit,
    decimal CurrentQuantity,
    decimal MinimumQuantity,
    DateTime? ExpiryDate,
    decimal UnitCost,
    bool IsLow,
    bool IsActive
);

public record StockMovementRequest(
    StockMovementType Type,
    decimal Quantity,
    string? Note
);

public record StockMovementResponse(
    Guid Id,
    Guid StockItemId,
    string StockItemName,
    StockMovementType Type,
    decimal Quantity,
    string? Note,
    DateTime MovedAt
);
