using MedicaAI.Core.DTOs.Notification;

namespace MedicaAI.Core.Interfaces;

public interface INotificationService
{
    Task<NotificationLogDto> SendAsync(SendNotificationRequest req);
    Task<IEnumerable<NotificationLogDto>> GetByPatientAsync(Guid patientId);
}
