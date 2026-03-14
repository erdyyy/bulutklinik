using BulutKlinik.Core.DTOs.Notification;

namespace BulutKlinik.Core.Interfaces;

public interface INotificationService
{
    Task<NotificationLogDto> SendAsync(SendNotificationRequest req);
    Task<IEnumerable<NotificationLogDto>> GetByPatientAsync(Guid patientId);
}
