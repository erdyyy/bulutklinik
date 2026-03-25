using MedicaAI.Core.DTOs.Consent;
using MedicaAI.Infrastructure.Services;
using MedicaAI.Tests.Helpers;
using Xunit;

namespace MedicaAI.Tests;

public class ConsentServiceTests
{
    private static (ConsentService svc, Guid doctorId, Guid patientId) Setup()
    {
        var db        = DbFactory.Create();
        var doctorId  = Guid.NewGuid();
        var patientId = Guid.NewGuid();
        return (new ConsentService(db), doctorId, patientId);
    }

    private static CreateConsentRequest BuildRequest(Guid doctorId, Guid patientId) => new(
        doctorId, patientId,
        PatientName:     "Ali Veli",
        PatientPhone:    "05001112233",
        TreatmentType:   "Botoks",
        ConsentText:     "Rıza metni...",
        KvkkAccepted:    true,
        MedicalAccepted: true,
        DisclaimerRead:  true,
        DoctorName:      "Dr. Ayşe"
    );

    [Fact]
    public async Task Create_ShouldPersistConsentRecord()
    {
        var (svc, doctorId, patientId) = Setup();

        var dto = await svc.CreateAsync(BuildRequest(doctorId, patientId));

        Assert.Equal("Ali Veli",  dto.PatientName);
        Assert.Equal("Botoks",    dto.TreatmentType);
        Assert.True(dto.KvkkAccepted);
        Assert.True(dto.MedicalAccepted);
        Assert.True(dto.DisclaimerRead);
        Assert.Equal(doctorId,    dto.DoctorId);
        Assert.Equal(patientId,   dto.PatientId);
    }

    [Fact]
    public async Task GetByDoctor_ShouldReturnOnlyDoctorsRecords()
    {
        var (svc, doctorId, patientId) = Setup();
        var otherDoctor = Guid.NewGuid();

        await svc.CreateAsync(BuildRequest(doctorId, patientId));
        await svc.CreateAsync(BuildRequest(otherDoctor, patientId));

        var results = (await svc.GetByDoctorAsync(doctorId)).ToList();

        Assert.Single(results);
        Assert.Equal(doctorId, results[0].DoctorId);
    }

    [Fact]
    public async Task GetByPatient_ShouldReturnAllPatientsConsents()
    {
        var (svc, doctorId, patientId) = Setup();
        var doctorId2 = Guid.NewGuid();

        await svc.CreateAsync(BuildRequest(doctorId,  patientId));
        await svc.CreateAsync(BuildRequest(doctorId2, patientId));

        var results = (await svc.GetByPatientAsync(patientId)).ToList();

        Assert.Equal(2, results.Count);
        Assert.All(results, r => Assert.Equal(patientId, r.PatientId));
    }

    [Fact]
    public async Task Create_ShouldSetSignedAtToRecentTime()
    {
        var (svc, doctorId, patientId) = Setup();
        var before = DateTime.UtcNow.AddSeconds(-1);

        var dto = await svc.CreateAsync(BuildRequest(doctorId, patientId));

        Assert.True(dto.SignedAt >= before);
        Assert.True(dto.SignedAt <= DateTime.UtcNow.AddSeconds(1));
    }
}
