namespace BulutKlinik.Core.Entities;

public class Payment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid InvoiceId { get; set; }
    public decimal Amount { get; set; }
    public PaymentMethod Method { get; set; }
    public bool IsDeleted { get; set; } = false;
    public DateTime PaidAt { get; set; } = DateTime.UtcNow;

    public Invoice Invoice { get; set; } = null!;
}

public enum PaymentMethod { Cash, CreditCard, BankTransfer }
