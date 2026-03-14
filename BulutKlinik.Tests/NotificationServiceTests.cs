using BulutKlinik.Core.DTOs.Notification;
using BulutKlinik.Core.Entities;
using BulutKlinik.Infrastructure.Persistence;
using BulutKlinik.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;

namespace BulutKlinik.Tests;

public class NotificationServiceTests : IDisposable
{
    private readonly AppDbContext _db;
    private readonly NotificationService _sut;
    private readonly Guid _patientId = Guid.NewGuid();

    public NotificationServiceTests()
    {
        var opts = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _db  = new AppDbContext(opts);
        _sut = new NotificationService(_db);

        _db.Users.Add(new User { Id = _patientId, Email = "hasta@test.com", PasswordHash = "x", PhoneNumber = "0", Role = UserRole.Patient });
        _db.SaveChanges();
    }

    [Fact]
    public async Task Send_EmailKanali_LogKaydiOlusturulmali()
    {
        var req = new SendNotificationRequest(_patientId, null, NotificationChannel.Email, "Randevunuz onaylandı.");

        var result = await _sut.SendAsync(req);

        Assert.Equal(NotificationChannel.Email, result.Channel);
        Assert.Equal("Randevunuz onaylandı.", result.Message);
        Assert.True(result.IsSuccess);
        Assert.Equal(_patientId, result.PatientId);
    }

    [Fact]
    public async Task Send_SmsKanali_LogKaydiOlusturulmali()
    {
        var req = new SendNotificationRequest(_patientId, null, NotificationChannel.SMS, "Yarın saat 10:00 randevunuz var.");

        var result = await _sut.SendAsync(req);

        Assert.Equal(NotificationChannel.SMS, result.Channel);
        Assert.True(result.IsSuccess);
    }

    [Fact]
    public async Task Send_BosMessaj_ArgumentException()
    {
        var req = new SendNotificationRequest(_patientId, null, NotificationChannel.Email, "");

        await Assert.ThrowsAsync<ArgumentException>(
            () => _sut.SendAsync(req));
    }

    [Fact]
    public async Task GetLogs_PatientIdFiltresi_SadeceIlgililer()
    {
        var other = Guid.NewGuid();
        _db.Users.Add(new User { Id = other, Email = "other@test.com", PasswordHash = "x", PhoneNumber = "0", Role = UserRole.Patient });
        _db.SaveChanges();

        await _sut.SendAsync(new SendNotificationRequest(_patientId, null, NotificationChannel.Email, "Mesaj 1"));
        await _sut.SendAsync(new SendNotificationRequest(_patientId, null, NotificationChannel.SMS,   "Mesaj 2"));
        await _sut.SendAsync(new SendNotificationRequest(other,      null, NotificationChannel.Email, "Diğer hasta"));

        var result = await _sut.GetLogsAsync(_patientId);

        Assert.Equal(2, result.Count);
        Assert.All(result, r => Assert.Equal(_patientId, r.PatientId));
    }

    [Fact]
    public async Task GetLogs_FiltreSiz_TumKayitlar()
    {
        var other = Guid.NewGuid();
        _db.Users.Add(new User { Id = other, Email = "other2@test.com", PasswordHash = "x", PhoneNumber = "0", Role = UserRole.Patient });
        _db.SaveChanges();

        await _sut.SendAsync(new SendNotificationRequest(_patientId, null, NotificationChannel.Email, "A"));
        await _sut.SendAsync(new SendNotificationRequest(other,      null, NotificationChannel.SMS,   "B"));

        var result = await _sut.GetLogsAsync(null);

        Assert.Equal(2, result.Count);
    }

    [Fact]
    public async Task LogAppointmentCreated_OtomatikEmailLog_OlusturulmalI()
    {
        var appointmentId = Guid.NewGuid();

        await _sut.LogAppointmentCreatedAsync(_patientId, appointmentId, "hasta@test.com");

        var logs = await _sut.GetLogsAsync(_patientId);
        Assert.Single(logs);
        Assert.Equal(NotificationChannel.Email, logs[0].Channel);
        Assert.Equal(appointmentId, logs[0].AppointmentId);
        Assert.Contains(appointmentId.ToString(), logs[0].Message);
    }

    [Fact]
    public async Task GetLogs_TersZamansiralama_EnYeniOnce()
    {
        await _sut.SendAsync(new SendNotificationRequest(_patientId, null, NotificationChannel.Email, "İlk"));
        await Task.Delay(10);
        await _sut.SendAsync(new SendNotificationRequest(_patientId, null, NotificationChannel.SMS, "Son"));

        var result = await _sut.GetLogsAsync(_patientId);

        Assert.Equal("Son", result[0].Message);
    }

    public void Dispose() => _db.Dispose();
}
