using BulutKlinik.Core.DTOs.Notification;
using BulutKlinik.Core.Entities;

namespace BulutKlinik.Core.Interfaces;

public interface INotificationService
{
    Task<NotificationLogResponse> SendAsync(SendNotificationRequest request);
    Task<List<NotificationLogResponse>> GetLogsAsync(Guid? patientId);
    Task LogAppointmentCreatedAsync(Guid patientId, Guid appointmentId, string patientEmail);
}
