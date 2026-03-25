using BulutKlinik.Core.Entities;
using Microsoft.EntityFrameworkCore;

namespace BulutKlinik.Infrastructure.Persistence;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Doctor> Doctors => Set<Doctor>();
    public DbSet<WorkingSchedule> WorkingSchedules => Set<WorkingSchedule>();
    public DbSet<DoctorLeave> DoctorLeaves => Set<DoctorLeave>();
    public DbSet<Appointment> Appointments => Set<Appointment>();

    // Sprint 3 - Medikal Takip
    public DbSet<PatientHistory> PatientHistories => Set<PatientHistory>();
    public DbSet<MedicalRecord> MedicalRecords => Set<MedicalRecord>();
    public DbSet<Measurement> Measurements => Set<Measurement>();

    // Sprint 4 - Finansal
    public DbSet<Service> Services => Set<Service>();
    public DbSet<Invoice> Invoices => Set<Invoice>();
    public DbSet<InvoiceItem> InvoiceItems => Set<InvoiceItem>();
    public DbSet<Payment> Payments => Set<Payment>();

    // Sprint 5 - Doküman + Stok
    public DbSet<Document> Documents => Set<Document>();
    public DbSet<StockItem> StockItems => Set<StockItem>();
    public DbSet<StockMovement> StockMovements => Set<StockMovement>();

    // Sprint 6 - Bildirim
    public DbSet<NotificationLog> NotificationLogs => Set<NotificationLog>();

    // Değerlendirme
    public DbSet<Review> Reviews => Set<Review>();

    // Tedavi Paketi
    public DbSet<TreatmentPackage> TreatmentPackages => Set<TreatmentPackage>();
    public DbSet<TreatmentSession> TreatmentSessions => Set<TreatmentSession>();

    // KVKK Rıza Formları
    public DbSet<ConsentRecord> ConsentRecords => Set<ConsentRecord>();

    // Ekip Yönetimi
    public DbSet<TeamMember> TeamMembers => Set<TeamMember>();

    protected override void OnModelCreating(ModelBuilder mb)
    {
        mb.Entity<User>(e =>
        {
            e.HasIndex(u => u.Email).IsUnique();
            e.Property(u => u.Role).HasConversion<string>();
        });

        mb.Entity<Doctor>(e =>
        {
            e.HasOne(d => d.User)
             .WithOne(u => u.Doctor)
             .HasForeignKey<Doctor>(d => d.Id);
        });

        mb.Entity<WorkingSchedule>(e =>
        {
            e.Property(w => w.DayOfWeek).HasConversion<string>();
            // Bir doktorun aynı günde sadece 1 aktif takvimi olabilir
            e.HasIndex(w => new { w.DoctorId, w.DayOfWeek })
             .HasFilter("\"IsActive\" = true")
             .IsUnique();
        });

        mb.Entity<Appointment>(e =>
        {
            e.Property(a => a.Status).HasConversion<string>();
            e.Property(a => a.Type).HasConversion<string>();
            // Aynı doktor + tarih + saat çakışmasını DB seviyesinde önle
            e.HasIndex(a => new { a.DoctorId, a.AppointmentDate, a.StartTime })
             .HasFilter("\"Status\" != 'Cancelled'")
             .IsUnique();
        });

        mb.Entity<DoctorLeave>(e =>
        {
            e.HasIndex(l => new { l.DoctorId, l.LeaveDate })
             .HasFilter("\"IsFullDay\" = true")
             .IsUnique();
        });

        mb.Entity<PatientHistory>(e =>
        {
            e.HasIndex(p => p.PatientId).IsUnique();
        });

        mb.Entity<MedicalRecord>(e =>
        {
            e.Property(m => m.CreatedAt).HasDefaultValueSql("NOW()");
        });

        mb.Entity<Measurement>(e =>
        {
            e.Property(m => m.Type).HasConversion<string>();
        });

        mb.Entity<Service>(e =>
        {
            e.Property(s => s.Category).HasConversion<string>();
            e.Property(s => s.Price).HasColumnType("decimal(18,2)");
        });

        mb.Entity<Invoice>(e =>
        {
            e.Property(i => i.Status).HasConversion<string>();
            e.Property(i => i.SubTotal).HasColumnType("decimal(18,2)");
            e.Property(i => i.DiscountAmount).HasColumnType("decimal(18,2)");
            e.Property(i => i.TotalAmount).HasColumnType("decimal(18,2)");
        });

        mb.Entity<InvoiceItem>(e =>
        {
            e.Property(i => i.UnitPrice).HasColumnType("decimal(18,2)");
            e.Property(i => i.TotalPrice).HasColumnType("decimal(18,2)");
        });

        mb.Entity<Payment>(e =>
        {
            e.Property(p => p.Method).HasConversion<string>();
            e.Property(p => p.Amount).HasColumnType("decimal(18,2)");
        });

        mb.Entity<Document>(e =>
        {
            e.Property(d => d.Category).HasConversion<string>();
        });

        mb.Entity<StockItem>(e =>
        {
            e.Property(s => s.UnitCost).HasColumnType("decimal(18,2)");
        });

        mb.Entity<StockMovement>(e =>
        {
            e.Property(s => s.Type).HasConversion<string>();
        });

        mb.Entity<NotificationLog>(e =>
        {
            e.Property(n => n.Channel).HasConversion<string>();
        });

        mb.Entity<Review>(e =>
        {
            // Her randevu için en fazla 1 değerlendirme
            e.HasIndex(r => r.AppointmentId).IsUnique();
        });

        mb.Entity<TreatmentPackage>(e =>
        {
            e.Property(p => p.PricePerPackage).HasColumnType("decimal(18,2)");
        });

        mb.Entity<TreatmentSession>(e =>
        {
            e.HasOne(s => s.Package)
             .WithMany(p => p.Sessions)
             .HasForeignKey(s => s.PackageId);
        });

        mb.Entity<TeamMember>(e =>
        {
            e.Property(m => m.Role).HasConversion<string>();
        });
    }
}
