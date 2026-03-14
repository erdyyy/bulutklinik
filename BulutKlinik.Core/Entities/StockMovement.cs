namespace BulutKlinik.Core.Entities;

public class StockMovement
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid StockItemId { get; set; }

    public StockMovementType Type { get; set; }
    public decimal Quantity { get; set; }
    public string? Note { get; set; }
    public DateTime MovedAt { get; set; } = DateTime.UtcNow;

    public StockItem StockItem { get; set; } = null!;
}

public enum StockMovementType { In, Out, Return, Waste }
