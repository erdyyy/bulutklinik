using BulutKlinik.Core.DTOs.Stock;
using BulutKlinik.Core.Entities;
using BulutKlinik.Core.Interfaces;
using BulutKlinik.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace BulutKlinik.Infrastructure.Services;

public class StockService(AppDbContext db) : IStockService
{
    public async Task<IEnumerable<StockItemDto>> GetAllAsync() =>
        await db.StockItems.Where(s => !s.IsDeleted).Select(s => Map(s)).ToListAsync();

    public async Task<StockItemDto> CreateAsync(CreateStockItemRequest req)
    {
        var item = new StockItem
        {
            Name = req.Name, Category = req.Category, Unit = req.Unit,
            MinimumQuantity = req.MinimumQuantity, ExpiryDate = req.ExpiryDate, UnitCost = req.UnitCost
        };
        db.StockItems.Add(item);
        await db.SaveChangesAsync();
        return Map(item);
    }

    public async Task<StockMovementDto> AddMovementAsync(Guid itemId, AddMovementRequest req)
    {
        if (!Enum.TryParse<StockMovementType>(req.Type, true, out var type))
            throw new ArgumentException($"Geçersiz hareket tipi: {req.Type}");
        var item = await db.StockItems.FindAsync(itemId) ?? throw new KeyNotFoundException("Stok kalemi bulunamadı.");
        item.CurrentQuantity += type == StockMovementType.In || type == StockMovementType.Return
            ? req.Quantity : -req.Quantity;
        if (item.CurrentQuantity < 0) throw new InvalidOperationException("Stok miktarı sıfırın altına düşemez.");
        var movement = new StockMovement { StockItemId = itemId, Type = type, Quantity = req.Quantity, Note = req.Note };
        db.StockMovements.Add(movement);
        await db.SaveChangesAsync();
        return new StockMovementDto(movement.Id, itemId, movement.Type.ToString(), movement.Quantity, movement.Note, movement.MovedAt);
    }

    public async Task<IEnumerable<StockItemDto>> GetLowStockAsync() =>
        await db.StockItems.Where(s => !s.IsDeleted && s.CurrentQuantity <= s.MinimumQuantity)
            .Select(s => Map(s)).ToListAsync();

    private static StockItemDto Map(StockItem s) => new(
        s.Id, s.Name, s.Category, s.Unit, s.CurrentQuantity, s.MinimumQuantity,
        s.ExpiryDate, s.UnitCost, s.IsActive, s.CurrentQuantity <= s.MinimumQuantity);
}
