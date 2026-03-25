using MedicaAI.Core.DTOs.Stock;
using MedicaAI.Infrastructure.Services;
using MedicaAI.Tests.Helpers;
using Xunit;

namespace MedicaAI.Tests;

public class StockServiceTests
{
    private static StockService Setup() => new(DbFactory.Create());

    [Fact]
    public async Task Create_ShouldStartWithZeroQuantity()
    {
        var svc = Setup();

        var dto = await svc.CreateAsync(new CreateStockItemRequest(
            "Botoks Vial", "Ilaç", "Adet", MinimumQuantity: 5, ExpiryDate: null, UnitCost: 250m));

        Assert.Equal("Botoks Vial", dto.Name);
        Assert.Equal(0, dto.CurrentQuantity);
        Assert.Equal(5, dto.MinimumQuantity);
        Assert.True(dto.IsLow); // 0 <= 5 → düşük stok
    }

    [Fact]
    public async Task AddMovement_In_ShouldIncreaseQuantity()
    {
        var svc = Setup();
        var item = await svc.CreateAsync(new CreateStockItemRequest("Ürün", "Cat", "Adet", 2, null, 10m));

        await svc.AddMovementAsync(item.Id, new AddMovementRequest("In", 10, "Alım"));

        var list = (await svc.GetAllAsync()).ToList();
        Assert.Equal(10, list[0].CurrentQuantity);
        Assert.False(list[0].IsLow); // 10 > 2
    }

    [Fact]
    public async Task AddMovement_Out_ShouldDecreaseQuantity()
    {
        var svc = Setup();
        var item = await svc.CreateAsync(new CreateStockItemRequest("Ürün", "Cat", "Adet", 2, null, 10m));
        await svc.AddMovementAsync(item.Id, new AddMovementRequest("In", 10, null));

        await svc.AddMovementAsync(item.Id, new AddMovementRequest("Out", 3, "Kullanım"));

        var list = (await svc.GetAllAsync()).ToList();
        Assert.Equal(7, list[0].CurrentQuantity);
    }

    [Fact]
    public async Task AddMovement_NegativeStock_ShouldThrow()
    {
        var svc = Setup();
        var item = await svc.CreateAsync(new CreateStockItemRequest("Ürün", "Cat", "Adet", 0, null, 10m));

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.AddMovementAsync(item.Id, new AddMovementRequest("Out", 1, null)));
    }

    [Fact]
    public async Task AddMovement_Return_ShouldIncreaseQuantity()
    {
        var svc = Setup();
        var item = await svc.CreateAsync(new CreateStockItemRequest("Ürün", "Cat", "Adet", 0, null, 5m));

        await svc.AddMovementAsync(item.Id, new AddMovementRequest("Return", 2, null));

        var list = (await svc.GetAllAsync()).ToList();
        Assert.Equal(2, list[0].CurrentQuantity);
    }

    [Fact]
    public async Task AddMovement_InvalidType_ShouldThrow()
    {
        var svc = Setup();
        var item = await svc.CreateAsync(new CreateStockItemRequest("Ürün", "Cat", "Adet", 0, null, 5m));

        await Assert.ThrowsAsync<ArgumentException>(
            () => svc.AddMovementAsync(item.Id, new AddMovementRequest("GECERSIZ", 1, null)));
    }

    [Fact]
    public async Task GetLowStock_ShouldReturnOnlyLowItems()
    {
        var svc = Setup();

        var low    = await svc.CreateAsync(new CreateStockItemRequest("Az", "Cat", "Adet", 5, null, 10m));
        var normal = await svc.CreateAsync(new CreateStockItemRequest("Tamam", "Cat", "Adet", 2, null, 10m));
        await svc.AddMovementAsync(normal.Id, new AddMovementRequest("In", 100, null));

        var lowList = (await svc.GetLowStockAsync()).ToList();

        Assert.Single(lowList);
        Assert.Equal("Az", lowList[0].Name);
    }

    [Fact]
    public async Task AddMovement_NonExistentItem_ShouldThrow()
    {
        var svc = Setup();

        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => svc.AddMovementAsync(Guid.NewGuid(), new AddMovementRequest("In", 5, null)));
    }
}
