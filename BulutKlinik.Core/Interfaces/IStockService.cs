using BulutKlinik.Core.DTOs.Stock;

namespace BulutKlinik.Core.Interfaces;

public interface IStockService
{
    Task<IEnumerable<StockItemDto>> GetAllAsync();
    Task<StockItemDto> CreateAsync(CreateStockItemRequest req);
    Task<StockMovementDto> AddMovementAsync(Guid itemId, AddMovementRequest req);
    Task<IEnumerable<StockItemDto>> GetLowStockAsync();
}
