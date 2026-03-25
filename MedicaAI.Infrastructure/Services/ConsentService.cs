using MedicaAI.Core.DTOs.Consent;
using MedicaAI.Core.Entities;
using MedicaAI.Core.Interfaces;
using MedicaAI.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MedicaAI.Infrastructure.Services;

public class ConsentService(AppDbContext db) : IConsentService
{
    public async Task<IEnumerable<ConsentRecordDto>> GetByDoctorAsync(Guid doctorId) =>
        await db.ConsentRecords
            .Where(c => c.DoctorId == doctorId)
            .OrderByDescending(c => c.SignedAt)
            .Select(c => Map(c))
            .ToListAsync();

    public async Task<IEnumerable<ConsentRecordDto>> GetByPatientAsync(Guid patientId) =>
        await db.ConsentRecords
            .Where(c => c.PatientId == patientId)
            .OrderByDescending(c => c.SignedAt)
            .Select(c => Map(c))
            .ToListAsync();

    public async Task<ConsentRecordDto> CreateAsync(CreateConsentRequest req)
    {
        var record = new ConsentRecord
        {
            DoctorId        = req.DoctorId,
            PatientId       = req.PatientId,
            PatientName     = req.PatientName,
            PatientPhone    = req.PatientPhone,
            TreatmentType   = req.TreatmentType,
            ConsentText     = req.ConsentText,
            KvkkAccepted    = req.KvkkAccepted,
            MedicalAccepted = req.MedicalAccepted,
            DisclaimerRead  = req.DisclaimerRead,
            DoctorName      = req.DoctorName,
        };
        db.ConsentRecords.Add(record);
        await db.SaveChangesAsync();
        return Map(record);
    }

    private static ConsentRecordDto Map(ConsentRecord c) => new(
        c.Id, c.DoctorId, c.PatientId,
        c.PatientName, c.PatientPhone, c.TreatmentType,
        c.ConsentText, c.KvkkAccepted, c.MedicalAccepted,
        c.DisclaimerRead, c.DoctorName, c.SignedAt
    );
}
