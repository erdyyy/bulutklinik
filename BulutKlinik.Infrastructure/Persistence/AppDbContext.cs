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
    }
}
