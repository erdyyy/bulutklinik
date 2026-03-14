using BulutKlinik.Core.DTOs.Notification;
using BulutKlinik.Core.Entities;
using BulutKlinik.Core.Interfaces;
using BulutKlinik.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace BulutKlinik.Infrastructure.Services;

public class NotificationService(AppDbContext db) : INotificationService
{
    public async Task<NotificationLogDto> SendAsync(SendNotificationRequest req)
    {
        if (!Enum.TryParse<NotificationChannel>(req.Channel, true, out var channel))
            throw new ArgumentException($"Geçersiz kanal: {req.Channel}. Geçerli: SMS, Email");
        // Gerçek gönderim yok — sadece DB'ye log yaz
        var log = new NotificationLog
        {
            PatientId = req.PatientId, AppointmentId = req.AppointmentId,
            Channel = channel, Message = req.Message, IsSuccess = true
        };
        db.NotificationLogs.Add(log);
        await db.SaveChangesAsync();
        return Map(log);
    }

    public async Task<IEnumerable<NotificationLogDto>> GetByPatientAsync(Guid patientId) =>
        await db.NotificationLogs.Where(n => n.PatientId == patientId)
            .OrderByDescending(n => n.SentAt).Select(n => Map(n)).ToListAsync();

    private static NotificationLogDto Map(NotificationLog n) => new(
        n.Id, n.PatientId, n.AppointmentId, n.Channel.ToString(), n.Message, n.IsSuccess, n.SentAt);
}
