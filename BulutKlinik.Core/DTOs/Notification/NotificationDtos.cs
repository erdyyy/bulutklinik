using BulutKlinik.Core.Entities;

namespace BulutKlinik.Core.DTOs.Notification;

public record SendNotificationRequest(
    Guid PatientId,
    Guid? AppointmentId,
    NotificationChannel Channel,
    string Message
);

public record NotificationLogResponse(
    Guid Id,
    Guid PatientId,
    Guid? AppointmentId,
    NotificationChannel Channel,
    string Message,
    bool IsSuccess,
    DateTime SentAt
);
