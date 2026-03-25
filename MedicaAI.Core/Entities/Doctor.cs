namespace MedicaAI.Core.Entities;

public class Doctor
{
    public Guid Id { get; set; }
    public string FullName { get; set; } = null!;
    public string Title { get; set; } = null!;
    public string Specialty { get; set; } = null!;
    public string? AvatarUrl { get; set; }

    public User User { get; set; } = null!;
    public ICollection<WorkingSchedule> WorkingSchedules { get; set; } = new List<WorkingSchedule>();
    public ICollection<DoctorLeave> Leaves { get; set; } = new List<DoctorLeave>();
    public ICollection<Appointment> Appointments { get; set; } = new List<Appointment>();
}
