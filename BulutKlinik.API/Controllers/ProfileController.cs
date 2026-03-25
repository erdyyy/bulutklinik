using System.Security.Claims;
using BulutKlinik.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BulutKlinik.API.Controllers;

[ApiController]
[Route("api/me")]
[Authorize]
public class ProfileController(AppDbContext db) : ControllerBase
{
    private Guid CurrentUserId =>
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<IActionResult> GetProfile()
    {
        var user = await db.Users
            .Include(u => u.Doctor)
            .FirstOrDefaultAsync(u => u.Id == CurrentUserId);

        if (user == null) return NotFound();

        return Ok(new
        {
            id          = user.Id,
            email       = user.Email,
            phoneNumber = user.PhoneNumber,
            role        = user.Role.ToString(),
            fullName    = user.Doctor?.FullName,
            title       = user.Doctor?.Title,
            specialty   = user.Doctor?.Specialty,
            avatarUrl   = user.Doctor?.AvatarUrl,
        });
    }

    [HttpPut]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest req)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == CurrentUserId);
        if (user == null) return NotFound();

        if (!string.IsNullOrWhiteSpace(req.PhoneNumber))
            user.PhoneNumber = req.PhoneNumber.Trim();

        if (user.Doctor != null && !string.IsNullOrWhiteSpace(req.FullName))
            user.Doctor.FullName = req.FullName.Trim();

        await db.SaveChangesAsync();
        return Ok(new { message = "Profil güncellendi." });
    }
}

public record UpdateProfileRequest(string? PhoneNumber, string? FullName);
