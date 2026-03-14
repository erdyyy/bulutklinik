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

    // Sprint 3 — Medikal
    public DbSet<PatientHistory> PatientHistories => Set<PatientHistory>();
    public DbSet<MedicalRecord> MedicalRecords => Set<MedicalRecord>();
    public DbSet<Measurement> Measurements => Set<Measurement>();

    // Sprint 4 — Finansal
    public DbSet<Service> Services => Set<Service>();
    public DbSet<Invoice> Invoices => Set<Invoice>();
    public DbSet<InvoiceItem> InvoiceItems => Set<InvoiceItem>();
    public DbSet<Payment> Payments => Set<Payment>();

    // Sprint 5 — Doküman + Stok
    public DbSet<Document> Documents => Set<Document>();
    public DbSet<StockItem> StockItems => Set<StockItem>();
    public DbSet<StockMovement> StockMovements => Set<StockMovement>();

    // Sprint 6 — Bildirim
    public DbSet<NotificationLog> NotificationLogs => Set<NotificationLog>();

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
            e.HasIndex(w => new { w.DoctorId, w.DayOfWeek })
             .HasFilter("\"IsActive\" = true")
             .IsUnique();
        });

        mb.Entity<Appointment>(e =>
        {
            e.Property(a => a.Status).HasConversion<string>();
            e.Property(a => a.Type).HasConversion<string>();
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

        // Sprint 3 — Medikal
        mb.Entity<PatientHistory>(e =>
        {
            e.HasOne(h => h.Patient).WithMany().HasForeignKey(h => h.PatientId).OnDelete(DeleteBehavior.Restrict);
            e.HasQueryFilter(h => !h.IsDeleted);
        });

        mb.Entity<MedicalRecord>(e =>
        {
            e.HasOne(r => r.Patient).WithMany().HasForeignKey(r => r.PatientId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(r => r.Doctor).WithMany().HasForeignKey(r => r.DoctorId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(r => r.Appointment).WithMany().HasForeignKey(r => r.AppointmentId).OnDelete(DeleteBehavior.SetNull);
            e.HasQueryFilter(r => !r.IsDeleted);
        });

        mb.Entity<Measurement>(e =>
        {
            e.Property(m => m.Type).HasConversion<string>();
            e.HasOne(m => m.Patient).WithMany().HasForeignKey(m => m.PatientId).OnDelete(DeleteBehavior.Restrict);
            e.HasQueryFilter(m => !m.IsDeleted);
        });

        // Sprint 4 — Finansal
        mb.Entity<Service>(e =>
        {
            e.Property(s => s.Category).HasConversion<string>();
            e.HasQueryFilter(s => !s.IsDeleted);
        });

        mb.Entity<Invoice>(e =>
        {
            e.Property(i => i.Status).HasConversion<string>();
            e.HasOne(i => i.Patient).WithMany().HasForeignKey(i => i.PatientId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(i => i.Doctor).WithMany().HasForeignKey(i => i.DoctorId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(i => i.Appointment).WithMany().HasForeignKey(i => i.AppointmentId).OnDelete(DeleteBehavior.SetNull);
            e.HasQueryFilter(i => !i.IsDeleted);
        });

        mb.Entity<InvoiceItem>(e =>
        {
            e.HasOne(ii => ii.Invoice).WithMany(i => i.Items).HasForeignKey(ii => ii.InvoiceId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(ii => ii.Service).WithMany().HasForeignKey(ii => ii.ServiceId).OnDelete(DeleteBehavior.Restrict);
            e.HasQueryFilter(ii => !ii.IsDeleted);
        });

        mb.Entity<Payment>(e =>
        {
            e.Property(p => p.Method).HasConversion<string>();
            e.HasOne(p => p.Invoice).WithMany(i => i.Payments).HasForeignKey(p => p.InvoiceId).OnDelete(DeleteBehavior.Restrict);
            e.HasQueryFilter(p => !p.IsDeleted);
        });

        // Sprint 5 — Doküman + Stok
        mb.Entity<Document>(e =>
        {
            e.Property(d => d.Category).HasConversion<string>();
            e.HasOne(d => d.Patient).WithMany().HasForeignKey(d => d.PatientId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(d => d.Appointment).WithMany().HasForeignKey(d => d.AppointmentId).OnDelete(DeleteBehavior.SetNull);
            e.HasQueryFilter(d => !d.IsDeleted);
        });

        mb.Entity<StockItem>(e =>
        {
            e.HasQueryFilter(s => !s.IsDeleted);
        });

        mb.Entity<StockMovement>(e =>
        {
            e.Property(sm => sm.Type).HasConversion<string>();
            e.HasOne(sm => sm.StockItem).WithMany(s => s.Movements).HasForeignKey(sm => sm.StockItemId).OnDelete(DeleteBehavior.Restrict);
        });

        // Sprint 6 — Bildirim
        mb.Entity<NotificationLog>(e =>
        {
            e.Property(n => n.Channel).HasConversion<string>();
            e.HasOne(n => n.Patient).WithMany().HasForeignKey(n => n.PatientId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(n => n.Appointment).WithMany().HasForeignKey(n => n.AppointmentId).OnDelete(DeleteBehavior.SetNull);
        });
    }
}
