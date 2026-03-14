namespace BulutKlinik.Core.Entities;

public class StockItem
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = null!;
    public string Category { get; set; } = null!;
    public string Unit { get; set; } = null!;
    public int CurrentQuantity { get; set; } = 0;
    public int MinimumQuantity { get; set; } = 0;
    public DateTime? ExpiryDate { get; set; }
    public decimal UnitCost { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsDeleted { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<StockMovement> Movements { get; set; } = new List<StockMovement>();
}
