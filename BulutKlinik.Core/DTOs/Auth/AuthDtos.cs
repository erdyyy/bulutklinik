namespace BulutKlinik.Core.DTOs.Auth;

public record RegisterRequest(
    string Email,
    string Password,
    string PhoneNumber,
    string Role
);

public record LoginRequest(string Email, string Password);

public record AuthResponse(
    string AccessToken,
    string RefreshToken,
    DateTime ExpiresAt,
    string Role,
    Guid UserId
);
