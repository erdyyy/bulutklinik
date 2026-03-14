namespace BulutKlinik.Core.DTOs.Stock;

public record StockItemDto(
    Guid Id, string Name, string Category, string Unit,
    int CurrentQuantity, int MinimumQuantity,
    DateTime? ExpiryDate, decimal UnitCost, bool IsActive,
    bool IsLow
);
public record CreateStockItemRequest(
    string Name, string Category, string Unit,
    int MinimumQuantity, DateTime? ExpiryDate, decimal UnitCost
);
public record StockMovementDto(Guid Id, Guid StockItemId, string Type, int Quantity, string? Note, DateTime MovedAt);
public record AddMovementRequest(string Type, int Quantity, string? Note);
