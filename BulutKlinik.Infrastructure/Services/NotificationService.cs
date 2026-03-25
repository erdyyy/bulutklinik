using System.Net;
using System.Net.Mail;
using System.Text;
using BulutKlinik.Core.DTOs.Notification;
using BulutKlinik.Core.Entities;
using BulutKlinik.Core.Interfaces;
using BulutKlinik.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace BulutKlinik.Infrastructure.Services;

public class NotificationService(
    AppDbContext db,
    IConfiguration config,
    ILogger<NotificationService> logger) : INotificationService
{
    public async Task<NotificationLogDto> SendAsync(SendNotificationRequest req)
    {
        if (!Enum.TryParse<NotificationChannel>(req.Channel, true, out var channel))
            throw new ArgumentException($"Geçersiz kanal: {req.Channel}. Geçerli: SMS, Email");

        bool isSuccess = channel switch
        {
            NotificationChannel.SMS   => await SendSmsAsync(req.Message),
            NotificationChannel.Email => await SendEmailAsync(req.PatientId, req.Message),
            _                         => false,
        };

        var log = new NotificationLog
        {
            PatientId     = req.PatientId,
            AppointmentId = req.AppointmentId,
            Channel       = channel,
            Message       = req.Message,
            IsSuccess     = isSuccess,
        };
        db.NotificationLogs.Add(log);
        await db.SaveChangesAsync();
        return Map(log);
    }

    public async Task<IEnumerable<NotificationLogDto>> GetByPatientAsync(Guid patientId) =>
        await db.NotificationLogs
            .Where(n => n.PatientId == patientId)
            .OrderByDescending(n => n.SentAt)
            .Select(n => Map(n))
            .ToListAsync();

    // ── Netgsm SMS ───────────────────────────────────────────────────────────
    private async Task<bool> SendSmsAsync(string message)
    {
        var netgsm = config.GetSection("Netgsm");
        if (!bool.TryParse(netgsm["Enabled"], out var netgsmEnabled) || !netgsmEnabled)
        {
            logger.LogInformation("[Netgsm] SMS gönderimi devre dışı (Enabled=false). Mesaj: {Msg}", message);
            return true; // devre dışıyken log başarılı say
        }

        try
        {
            var userCode = netgsm["UserCode"]!;
            var password = netgsm["Password"]!;
            var header   = netgsm["Header"]!;

            // Netgsm REST XML API — https://www.netgsm.com.tr/dokuman
            var xml = $"""
                       <?xml version="1.0" encoding="UTF-8"?>
                       <mainbody>
                         <header>
                           <company dil="TR">Netgsm</company>
                           <usercode>{userCode}</usercode>
                           <password>{password}</password>
                           <msgheader>{header}</msgheader>
                         </header>
                         <body>
                           <msg><![CDATA[{message}]]></msg>
                         </body>
                       </mainbody>
                       """;

            using var http = new HttpClient();
            var content  = new StringContent(xml, Encoding.UTF8, "application/xml");
            var response = await http.PostAsync("https://api.netgsm.com.tr/sms/send/xml", content);

            var body = await response.Content.ReadAsStringAsync();
            logger.LogInformation("[Netgsm] Yanıt: {Status} — {Body}", response.StatusCode, body);

            // Netgsm başarı kodu "00" ile başlar
            return body.StartsWith("00");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[Netgsm] SMS gönderimi başarısız.");
            return false;
        }
    }

    // ── SMTP Email ───────────────────────────────────────────────────────────
    private async Task<bool> SendEmailAsync(Guid patientId, string message)
    {
        var smtp = config.GetSection("Smtp");
        if (!bool.TryParse(smtp["Enabled"], out var smtpEnabled) || !smtpEnabled)
        {
            logger.LogInformation("[SMTP] E-posta gönderimi devre dışı (Enabled=false). Mesaj: {Msg}", message);
            return true;
        }

        try
        {
            var patient = await db.Users.FindAsync(patientId);
            if (patient is null) return false;

            using var client = new SmtpClient(smtp["Host"], int.TryParse(smtp["Port"], out var smtpPort) ? smtpPort : 587)
            {
                Credentials = new NetworkCredential(smtp["Username"], smtp["Password"]),
                EnableSsl   = true,
            };

            var mail = new MailMessage
            {
                From       = new MailAddress(smtp["Username"]!, smtp["FromName"]),
                Subject    = "BulutKlinik Bildirim",
                Body       = message,
                IsBodyHtml = false,
            };
            mail.To.Add(patient.Email);

            await client.SendMailAsync(mail);
            logger.LogInformation("[SMTP] E-posta gönderildi: {Email}", patient.Email);
            return true;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[SMTP] E-posta gönderimi başarısız.");
            return false;
        }
    }

    private static NotificationLogDto Map(NotificationLog n) => new(
        n.Id, n.PatientId, n.AppointmentId,
        n.Channel.ToString(), n.Message, n.IsSuccess, n.SentAt);
}
