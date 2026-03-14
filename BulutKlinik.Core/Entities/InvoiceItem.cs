namespace BulutKlinik.Core.Entities;

public class InvoiceItem
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid InvoiceId { get; set; }
    public Guid ServiceId { get; set; }

    public int Quantity { get; set; } = 1;
    public decimal UnitPrice { get; set; }
    public decimal TotalPrice { get; set; }
    public bool IsDeleted { get; set; } = false;

    public Invoice Invoice { get; set; } = null!;
    public Service Service { get; set; } = null!;
}
