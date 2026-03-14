using BulutKlinik.Core.DTOs.Notification;
using BulutKlinik.Core.Entities;
using BulutKlinik.Core.Interfaces;
using BulutKlinik.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace BulutKlinik.Infrastructure.Services;

public class NotificationService(AppDbContext db) : INotificationService
{
    public async Task<NotificationLogResponse> SendAsync(SendNotificationRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Message))
            throw new ArgumentException("Mesaj boş olamaz.");

        // Gerçek SMS/Email entegrasyonu yok — sadece DB'ye log
        var log = new NotificationLog
        {
            PatientId     = request.PatientId,
            AppointmentId = request.AppointmentId,
            Channel       = request.Channel,
            Message       = request.Message,
            IsSuccess     = true
        };
        db.NotificationLogs.Add(log);
        await db.SaveChangesAsync();
        return ToResponse(log);
    }

    public async Task<List<NotificationLogResponse>> GetLogsAsync(Guid? patientId)
    {
        var query = db.NotificationLogs.AsQueryable();
        if (patientId.HasValue)
            query = query.Where(n => n.PatientId == patientId.Value);

        var logs = await query.OrderByDescending(n => n.SentAt).ToListAsync();
        return logs.Select(ToResponse).ToList();
    }

    public async Task LogAppointmentCreatedAsync(Guid patientId, Guid appointmentId, string patientEmail)
    {
        var message = $"Randevunuz başarıyla oluşturuldu. Randevu ID: {appointmentId}";

        var emailLog = new NotificationLog
        {
            PatientId     = patientId,
            AppointmentId = appointmentId,
            Channel       = NotificationChannel.Email,
            Message       = message,
            IsSuccess     = true
        };
        db.NotificationLogs.Add(emailLog);
        await db.SaveChangesAsync();
    }

    private static NotificationLogResponse ToResponse(NotificationLog n) => new(
        n.Id, n.PatientId, n.AppointmentId, n.Channel, n.Message, n.IsSuccess, n.SentAt);
}
