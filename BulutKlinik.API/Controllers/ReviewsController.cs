using System.Security.Claims;
using BulutKlinik.Core.Entities;
using BulutKlinik.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BulutKlinik.API.Controllers;

[ApiController]
[Route("api")]
[Authorize]
public class ReviewsController(AppDbContext db) : ControllerBase
{
    private Guid CurrentUserId =>
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    /// <summary>Hasta randevu sonrası değerlendirme gönderir.</summary>
    [HttpPost("appointments/{appointmentId:guid}/review")]
    [Authorize(Roles = "Patient")]
    public async Task<IActionResult> CreateReview(Guid appointmentId, [FromBody] CreateReviewRequest req)
    {
        if (req.Rating < 1 || req.Rating > 5)
            return BadRequest(new { message = "Puan 1 ile 5 arasında olmalıdır." });

        var apt = await db.Appointments.FindAsync(appointmentId);
        if (apt == null) return NotFound(new { message = "Randevu bulunamadı." });
        if (apt.PatientId != CurrentUserId)
            return Forbid();
        if (apt.Status != AppointmentStatus.Completed)
            return BadRequest(new { message = "Sadece tamamlanan randevular değerlendirilebilir." });

        if (await db.Reviews.AnyAsync(r => r.AppointmentId == appointmentId))
            return Conflict(new { message = "Bu randevu için zaten değerlendirme yapılmış." });

        var review = new BulutKlinik.Core.Entities.Review
        {
            AppointmentId = appointmentId,
            PatientId     = CurrentUserId,
            DoctorId      = apt.DoctorId,
            Rating        = req.Rating,
            Comment       = req.Comment?.Trim(),
        };

        db.Reviews.Add(review);
        await db.SaveChangesAsync();

        return Ok(new { id = review.Id, rating = review.Rating, comment = review.Comment });
    }

    /// <summary>Hastanın kendi değerlendirmesini getirir (randevu ID'si ile).</summary>
    [HttpGet("appointments/{appointmentId:guid}/review")]
    public async Task<IActionResult> GetReview(Guid appointmentId)
    {
        var review = await db.Reviews.FirstOrDefaultAsync(r => r.AppointmentId == appointmentId);
        if (review == null) return NotFound();
        return Ok(review);
    }

    /// <summary>Doktora ait tüm değerlendirmeleri getirir.</summary>
    [HttpGet("doctors/{doctorId:guid}/reviews")]
    public async Task<IActionResult> GetDoctorReviews(Guid doctorId)
    {
        var reviews = await db.Reviews
            .Where(r => r.DoctorId == doctorId)
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new {
                r.Id, r.Rating, r.Comment, r.CreatedAt,
                average = db.Reviews.Where(x => x.DoctorId == doctorId).Average(x => (double)x.Rating)
            })
            .ToListAsync();

        return Ok(reviews);
    }
}

public record CreateReviewRequest(int Rating, string? Comment);
