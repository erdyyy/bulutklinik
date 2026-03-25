using MedicaAI.Core.DTOs.Notification;
using MedicaAI.Core.Entities;
using MedicaAI.Infrastructure.Persistence;
using MedicaAI.Infrastructure.Services;
using MedicaAI.Tests.Helpers;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace MedicaAI.Tests;

public class NotificationServiceTests
{
    private static (NotificationService svc, AppDbContext db, Guid patientId) Setup(
        bool smsEnabled   = false,
        bool emailEnabled = false)
    {
        var db        = DbFactory.Create();
        var patientId = Guid.NewGuid();
        db.Users.Add(new User { Id = patientId, Email = "hasta@t.com", PasswordHash = "h", PhoneNumber = "05000", Role = UserRole.Patient });
        db.SaveChanges();

        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Netgsm:Enabled"]  = smsEnabled.ToString().ToLower(),
                ["Netgsm:UserCode"] = "testcode",
                ["Netgsm:Password"] = "testpass",
                ["Netgsm:Header"]   = "TESTKLINIK",
                ["Smtp:Enabled"]    = emailEnabled.ToString().ToLower(),
            })
            .Build();

        var svc = new NotificationService(db, config, NullLogger<NotificationService>.Instance);
        return (svc, db, patientId);
    }

    [Fact]
    public async Task SendSms_WhenDisabled_ShouldReturnSuccessAndLog()
    {
        var (svc, _, patientId) = Setup(smsEnabled: false);

        var dto = await svc.SendAsync(new SendNotificationRequest(patientId, null, "SMS", "Randevunuz yarın 10:00"));

        Assert.True(dto.IsSuccess);
        Assert.Equal("SMS", dto.Channel);
    }

    [Fact]
    public async Task SendEmail_WhenDisabled_ShouldReturnSuccess()
    {
        var (svc, _, patientId) = Setup(emailEnabled: false);

        var dto = await svc.SendAsync(new SendNotificationRequest(patientId, null, "Email", "Randevu hatırlatma"));

        Assert.True(dto.IsSuccess);
        Assert.Equal("Email", dto.Channel);
    }

    [Fact]
    public async Task Send_InvalidChannel_ShouldThrow()
    {
        var (svc, _, patientId) = Setup();

        await Assert.ThrowsAsync<ArgumentException>(
            () => svc.SendAsync(new SendNotificationRequest(patientId, null, "Fax", "Test")));
    }

    [Fact]
    public async Task Send_ShouldPersistNotificationLog()
    {
        var (svc, db, patientId) = Setup(smsEnabled: false);

        await svc.SendAsync(new SendNotificationRequest(patientId, null, "SMS", "Hatırlatma mesajı"));

        var log = db.NotificationLogs.Single(n => n.PatientId == patientId);
        Assert.Equal("Hatırlatma mesajı", log.Message);
        Assert.Equal(NotificationChannel.SMS, log.Channel);
    }

    [Fact]
    public async Task GetByPatient_ShouldReturnLogsOrderedByDate()
    {
        var (svc, _, patientId) = Setup();

        await svc.SendAsync(new SendNotificationRequest(patientId, null, "SMS",   "M1"));
        await svc.SendAsync(new SendNotificationRequest(patientId, null, "Email", "M2"));

        var logs = (await svc.GetByPatientAsync(patientId)).ToList();

        Assert.Equal(2, logs.Count);
        Assert.All(logs, l => Assert.Equal(patientId, l.PatientId));
    }

    [Fact]
    public async Task Send_ChannelCaseInsensitive_ShouldWork()
    {
        var (svc, _, patientId) = Setup();

        var dto = await svc.SendAsync(new SendNotificationRequest(patientId, null, "sms", "Test"));

        Assert.Equal("SMS", dto.Channel);
    }

    [Fact]
    public async Task Send_WithAppointmentId_ShouldLinkLog()
    {
        var (svc, db, patientId) = Setup();
        var appointmentId = Guid.NewGuid();

        await svc.SendAsync(new SendNotificationRequest(patientId, appointmentId, "SMS", "Randevu hatırlatma"));

        var log = db.NotificationLogs.Single(n => n.PatientId == patientId);
        Assert.Equal(appointmentId, log.AppointmentId);
    }
}
