using BulutKlinik.Core.DTOs.Medical;
using BulutKlinik.Core.Entities;
using BulutKlinik.Infrastructure.Persistence;
using BulutKlinik.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;

namespace BulutKlinik.Tests;

public class MedicalServiceTests : IDisposable
{
    private readonly AppDbContext _db;
    private readonly MedicalService _sut;
    private readonly Guid _patientId = Guid.NewGuid();
    private readonly Guid _doctorId  = Guid.NewGuid();

    public MedicalServiceTests()
    {
        var opts = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _db  = new AppDbContext(opts);
        _sut = new MedicalService(_db);

        _db.Users.Add(new User { Id = _patientId, Email = "hasta@test.com", PasswordHash = "x", PhoneNumber = "0", Role = UserRole.Patient });
        _db.Users.Add(new User { Id = _doctorId,  Email = "dr@test.com",    PasswordHash = "x", PhoneNumber = "0", Role = UserRole.Doctor });
        _db.Doctors.Add(new Doctor { Id = _doctorId, FullName = "Dr. Test", Title = "Dr.", Specialty = "Genel" });
        _db.SaveChanges();
    }

    // ── PatientHistory ────────────────────────────────────────────

    [Fact]
    public async Task UpsertHistory_YeniKayit_OlusturulmalI()
    {
        var req = new PatientHistoryRequest("Diyabet", "Penisilin", null, null, "Metformin", "A+");

        var result = await _sut.UpsertHistoryAsync(_patientId, req);

        Assert.Equal(_patientId, result.PatientId);
        Assert.Equal("Diyabet", result.ChronicDiseases);
        Assert.Equal("A+", result.BloodType);
    }

    [Fact]
    public async Task UpsertHistory_MevcutKayit_Guncellenmeli()
    {
        // İlk kayıt
        await _sut.UpsertHistoryAsync(_patientId, new PatientHistoryRequest("Eski", null, null, null, null, "B+"));

        // Güncelleme
        var result = await _sut.UpsertHistoryAsync(_patientId, new PatientHistoryRequest("Yeni", "Polen", null, null, null, "A-"));

        Assert.Equal("Yeni", result.ChronicDiseases);
        Assert.Equal("A-", result.BloodType);

        // Sadece 1 kayıt olmalı
        var count = _db.PatientHistories.Count();
        Assert.Equal(1, count);
    }

    [Fact]
    public async Task GetHistory_KayitYok_NullDonmeli()
    {
        var result = await _sut.GetHistoryAsync(Guid.NewGuid());
        Assert.Null(result);
    }

    [Fact]
    public async Task GetHistory_KayitVar_DogruVerDonmeli()
    {
        await _sut.UpsertHistoryAsync(_patientId, new PatientHistoryRequest(null, "Aspirin", null, null, null, "0+"));

        var result = await _sut.GetHistoryAsync(_patientId);

        Assert.NotNull(result);
        Assert.Equal("Aspirin", result.Allergies);
        Assert.Equal("0+", result.BloodType);
    }

    // ── MedicalRecord ─────────────────────────────────────────────

    [Fact]
    public async Task CreateMedicalRecord_BosChiefComplaint_ArgumentException()
    {
        var req = new CreateMedicalRecordRequest(null, "", null, null, null, null);

        await Assert.ThrowsAsync<ArgumentException>(
            () => _sut.CreateMedicalRecordAsync(_patientId, _doctorId, Guid.Empty, req));
    }

    [Fact]
    public async Task CreateMedicalRecord_GecerliVeri_KayitOlusturulmali()
    {
        var req = new CreateMedicalRecordRequest(null, "Baş ağrısı", "Tansiyon yüksek", "Hipertansiyon", "İlaç tedavisi", "I10");

        var result = await _sut.CreateMedicalRecordAsync(_patientId, _doctorId, Guid.Empty, req);

        Assert.Equal("Baş ağrısı", result.ChiefComplaint);
        Assert.Equal("Hipertansiyon", result.Diagnosis);
        Assert.Equal("I10", result.IcdCode);
        Assert.Equal("Dr. Test", result.DoctorName);
    }

    [Fact]
    public async Task GetMedicalRecords_BirdenFazlaKayit_TersKronolojikSirada()
    {
        var req1 = new CreateMedicalRecordRequest(null, "Şikayet 1", null, null, null, null);
        var req2 = new CreateMedicalRecordRequest(null, "Şikayet 2", null, null, null, null);
        await _sut.CreateMedicalRecordAsync(_patientId, _doctorId, Guid.Empty, req1);
        await Task.Delay(10); // CreatedAt farkı için
        await _sut.CreateMedicalRecordAsync(_patientId, _doctorId, Guid.Empty, req2);

        var result = await _sut.GetMedicalRecordsAsync(_patientId);

        Assert.Equal(2, result.Count);
        Assert.Equal("Şikayet 2", result[0].ChiefComplaint); // En yeni önce
    }

    // ── Measurement ───────────────────────────────────────────────

    [Fact]
    public async Task AddMeasurement_GecerliVeri_KayitOlusturulmali()
    {
        var req = new CreateMeasurementRequest(MeasurementType.BloodPressure, "120/80", "mmHg", null);

        var result = await _sut.AddMeasurementAsync(_patientId, req);

        Assert.Equal(MeasurementType.BloodPressure, result.Type);
        Assert.Equal("120/80", result.Value);
        Assert.Equal("mmHg", result.Unit);
    }

    [Fact]
    public async Task AddMeasurement_BosValue_ArgumentException()
    {
        var req = new CreateMeasurementRequest(MeasurementType.Weight, "", "kg", null);

        await Assert.ThrowsAsync<ArgumentException>(
            () => _sut.AddMeasurementAsync(_patientId, req));
    }

    [Fact]
    public async Task GetMeasurements_TypeFiltresi_SadeceOTurDonmeli()
    {
        await _sut.AddMeasurementAsync(_patientId, new CreateMeasurementRequest(MeasurementType.Weight, "75", "kg", null));
        await _sut.AddMeasurementAsync(_patientId, new CreateMeasurementRequest(MeasurementType.HeartRate, "72", "bpm", null));
        await _sut.AddMeasurementAsync(_patientId, new CreateMeasurementRequest(MeasurementType.Weight, "76", "kg", null));

        var result = await _sut.GetMeasurementsAsync(_patientId, MeasurementType.Weight);

        Assert.Equal(2, result.Count);
        Assert.All(result, m => Assert.Equal(MeasurementType.Weight, m.Type));
    }

    [Fact]
    public async Task GetMeasurements_FiltreSiz_TumOlcumlerDonmeli()
    {
        await _sut.AddMeasurementAsync(_patientId, new CreateMeasurementRequest(MeasurementType.Weight, "75", "kg", null));
        await _sut.AddMeasurementAsync(_patientId, new CreateMeasurementRequest(MeasurementType.Temperature, "36.5", "°C", null));

        var result = await _sut.GetMeasurementsAsync(_patientId, null);

        Assert.Equal(2, result.Count);
    }

    public void Dispose() => _db.Dispose();
}
