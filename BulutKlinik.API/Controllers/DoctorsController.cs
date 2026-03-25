using BulutKlinik.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BulutKlinik.API.Controllers;

[ApiController]
[Route("api/doctors")]
[Authorize]
public class DoctorsController(AppDbContext db) : ControllerBase
{
    /// <summary>Tüm aktif doktorları listeler.</summary>
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var doctors = await db.Doctors
            .Include(d => d.User)
            .Where(d => d.User.IsActive)
            .Select(d => new {
                id        = d.Id,
                fullName  = d.FullName,
                title     = d.Title,
                specialty = d.Specialty,
                avatarUrl = d.AvatarUrl,
                avgRating = db.Reviews.Where(r => r.DoctorId == d.Id).Any()
                            ? db.Reviews.Where(r => r.DoctorId == d.Id).Average(r => (double)r.Rating)
                            : (double?)null,
                reviewCount = db.Reviews.Count(r => r.DoctorId == d.Id),
            })
            .OrderBy(d => d.fullName)
            .ToListAsync();

        return Ok(doctors);
    }

    /// <summary>Belirli bir doktorun profilini getirir.</summary>
    [HttpGet("{doctorId:guid}")]
    public async Task<IActionResult> GetProfile(Guid doctorId)
    {
        var doctor = await db.Doctors
            .Include(d => d.User)
            .Include(d => d.WorkingSchedules)
            .Where(d => d.Id == doctorId)
            .Select(d => new {
                id        = d.Id,
                fullName  = d.FullName,
                title     = d.Title,
                specialty = d.Specialty,
                avatarUrl = d.AvatarUrl,
                avgRating = db.Reviews.Where(r => r.DoctorId == d.Id).Any()
                            ? db.Reviews.Where(r => r.DoctorId == d.Id).Average(r => (double)r.Rating)
                            : (double?)null,
                reviewCount = db.Reviews.Count(r => r.DoctorId == d.Id),
                reviews   = db.Reviews
                              .Where(r => r.DoctorId == doctorId)
                              .OrderByDescending(r => r.CreatedAt)
                              .Take(10)
                              .Select(r => new { r.Rating, r.Comment, r.CreatedAt })
                              .ToList(),
                schedules = d.WorkingSchedules
                              .Where(s => s.IsActive)
                              .Select(s => new { s.DayOfWeek, s.StartTime, s.EndTime })
                              .ToList(),
            })
            .FirstOrDefaultAsync();

        if (doctor == null) return NotFound();
        return Ok(doctor);
    }
}
