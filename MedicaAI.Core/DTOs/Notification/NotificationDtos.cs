namespace MedicaAI.Core.DTOs.Notification;

public record NotificationLogDto(
    Guid Id, Guid PatientId, Guid? AppointmentId,
    string Channel, string Message, bool IsSuccess, DateTime SentAt
);
public record SendNotificationRequest(
    Guid PatientId, Guid? AppointmentId, string Channel, string Message
);
