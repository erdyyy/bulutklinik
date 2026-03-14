using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using BulutKlinik.Core.DTOs.Auth;
using BulutKlinik.Core.Entities;
using BulutKlinik.Core.Interfaces;
using BulutKlinik.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace BulutKlinik.Infrastructure.Services;

public class AuthService(AppDbContext db, IConfiguration config) : IAuthService
{
    public async Task<AuthResponse> RegisterAsync(RegisterRequest req)
    {
        if (await db.Users.AnyAsync(u => u.Email == req.Email.ToLower()))
            throw new InvalidOperationException("Bu e-posta zaten kayıtlı.");

        if (!Enum.TryParse<UserRole>(req.Role, ignoreCase: true, out var role))
            throw new ArgumentException($"Geçersiz rol: {req.Role}. Geçerli değerler: Patient, Doctor, Staff");

        var user = new User
        {
            Email        = req.Email.ToLower().Trim(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password),
            PhoneNumber  = req.PhoneNumber,
            Role         = role
        };

        db.Users.Add(user);
        await db.SaveChangesAsync();

        return GenerateTokens(user);
    }

    public async Task<AuthResponse> LoginAsync(LoginRequest req)
    {
        var user = await db.Users
            .FirstOrDefaultAsync(u => u.Email == req.Email.ToLower().Trim())
            ?? throw new UnauthorizedAccessException("E-posta veya şifre hatalı.");

        if (!BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
            throw new UnauthorizedAccessException("E-posta veya şifre hatalı.");

        if (!user.IsActive)
            throw new UnauthorizedAccessException("Hesabınız aktif değil. Lütfen destek ile iletişime geçin.");

        return GenerateTokens(user);
    }

    // ── Token üretimi ────────────────────────────────────────────
    private AuthResponse GenerateTokens(User user)
    {
        var jwtKey     = config["Jwt:Key"]
            ?? throw new InvalidOperationException("Jwt:Key konfigürasyonu eksik.");
        var jwtIssuer  = config["Jwt:Issuer"]
            ?? throw new InvalidOperationException("Jwt:Issuer konfigürasyonu eksik.");
        var expMinutes = int.Parse(config["Jwt:ExpiresInMinutes"] ?? "60");

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Role, user.Role.ToString()),
        };

        var key     = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
        var creds   = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expires = DateTime.UtcNow.AddMinutes(expMinutes);

        var token = new JwtSecurityToken(
            issuer:            jwtIssuer,
            audience:          jwtIssuer,
            claims:            claims,
            expires:           expires,
            signingCredentials: creds
        );

        var accessToken  = new JwtSecurityTokenHandler().WriteToken(token);
        var refreshToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));

        return new AuthResponse(accessToken, refreshToken, expires, user.Role.ToString(), user.Id);
    }
}
