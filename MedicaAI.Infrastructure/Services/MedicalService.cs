using MedicaAI.Core.DTOs.Medical;
using MedicaAI.Core.Entities;
using MedicaAI.Core.Interfaces;
using MedicaAI.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MedicaAI.Infrastructure.Services;

public class MedicalService(AppDbContext db) : IMedicalService
{
    public async Task<PatientHistoryDto> GetHistoryAsync(Guid patientId)
    {
        var h = await db.PatientHistories.FirstOrDefaultAsync(x => x.PatientId == patientId && !x.IsDeleted);
        if (h == null) return new PatientHistoryDto(patientId, null, null, null, null, null, null);
        return Map(h);
    }

    public async Task<PatientHistoryDto> UpsertHistoryAsync(Guid patientId, UpsertHistoryRequest req)
    {
        var h = await db.PatientHistories.FirstOrDefaultAsync(x => x.PatientId == patientId && !x.IsDeleted);
        if (h == null)
        {
            h = new PatientHistory { PatientId = patientId };
            db.PatientHistories.Add(h);
        }
        h.ChronicDiseases    = req.ChronicDiseases;
        h.Allergies          = req.Allergies;
        h.FamilyHistory      = req.FamilyHistory;
        h.PreviousSurgeries  = req.PreviousSurgeries;
        h.CurrentMedications = req.CurrentMedications;
        h.BloodType          = req.BloodType;
        h.UpdatedAt          = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Map(h);
    }

    public async Task<MedicalRecordDto> CreateRecordAsync(Guid appointmentId, CreateMedicalRecordRequest req)
    {
        var apt = await db.Appointments.FindAsync(appointmentId)
            ?? throw new KeyNotFoundException("Randevu bulunamadı.");
        var doctor = await db.Doctors.FindAsync(req.DoctorId)
            ?? throw new KeyNotFoundException("Doktor bulunamadı.");

        var record = new MedicalRecord
        {
            PatientId      = apt.PatientId,
            DoctorId       = req.DoctorId,
            AppointmentId  = appointmentId,
            ChiefComplaint = req.ChiefComplaint,
            Findings       = req.Findings,
            Diagnosis      = req.Diagnosis,
            TreatmentPlan  = req.TreatmentPlan,
            IcdCode        = req.IcdCode
        };
        db.MedicalRecords.Add(record);
        await db.SaveChangesAsync();
        return MapRecord(record, doctor.FullName);
    }

    public async Task<IEnumerable<MedicalRecordDto>> GetRecordsAsync(Guid patientId)
    {
        return await db.MedicalRecords
            .Where(r => r.PatientId == patientId && !r.IsDeleted)
            .Include(r => r.Doctor)
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => MapRecord(r, r.Doctor.FullName))
            .ToListAsync();
    }

    public async Task<MeasurementDto> CreateMeasurementAsync(Guid patientId, CreateMeasurementRequest req)
    {
        if (!Enum.TryParse<MeasurementType>(req.Type, true, out var type))
            throw new ArgumentException($"Geçersiz ölçüm tipi: {req.Type}");

        var m = new Measurement
        {
            PatientId  = patientId,
            Type       = type,
            Value      = req.Value,
            Unit       = req.Unit,
            MeasuredAt = req.MeasuredAt ?? DateTime.UtcNow
        };
        db.Measurements.Add(m);
        await db.SaveChangesAsync();
        return MapMeasurement(m);
    }

    public async Task<IEnumerable<MeasurementDto>> GetMeasurementsAsync(Guid patientId, string? type)
    {
        var query = db.Measurements.Where(m => m.PatientId == patientId && !m.IsDeleted);
        if (!string.IsNullOrWhiteSpace(type) && Enum.TryParse<MeasurementType>(type, true, out var t))
            query = query.Where(m => m.Type == t);
        return await query.OrderByDescending(m => m.MeasuredAt).Select(m => MapMeasurement(m)).ToListAsync();
    }

    private static PatientHistoryDto Map(PatientHistory h) => new(
        h.PatientId, h.ChronicDiseases, h.Allergies,
        h.FamilyHistory, h.PreviousSurgeries, h.CurrentMedications, h.BloodType);

    private static MedicalRecordDto MapRecord(MedicalRecord r, string doctorName) => new(
        r.Id, r.PatientId, r.DoctorId, doctorName, r.AppointmentId,
        r.ChiefComplaint, r.Findings, r.Diagnosis, r.TreatmentPlan, r.IcdCode, r.CreatedAt);

    private static MeasurementDto MapMeasurement(Measurement m) => new(
        m.Id, m.PatientId, m.Type.ToString(), m.Value, m.Unit, m.MeasuredAt);
}
