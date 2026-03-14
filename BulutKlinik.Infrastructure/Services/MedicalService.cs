using BulutKlinik.Core.DTOs.Medical;
using BulutKlinik.Core.Entities;
using BulutKlinik.Core.Interfaces;
using BulutKlinik.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace BulutKlinik.Infrastructure.Services;

public class MedicalService(AppDbContext db) : IMedicalService
{
    public async Task<PatientHistoryResponse> UpsertHistoryAsync(Guid patientId, PatientHistoryRequest request)
    {
        var history = await db.PatientHistories
            .FirstOrDefaultAsync(h => h.PatientId == patientId && !h.IsDeleted);

        if (history is null)
        {
            history = new PatientHistory { PatientId = patientId };
            db.PatientHistories.Add(history);
        }

        history.ChronicDiseases    = request.ChronicDiseases;
        history.Allergies          = request.Allergies;
        history.FamilyHistory      = request.FamilyHistory;
        history.PreviousSurgeries  = request.PreviousSurgeries;
        history.CurrentMedications = request.CurrentMedications;
        history.BloodType          = request.BloodType;
        history.UpdatedAt          = DateTime.UtcNow;

        await db.SaveChangesAsync();
        return ToResponse(history);
    }

    public async Task<PatientHistoryResponse?> GetHistoryAsync(Guid patientId)
    {
        var history = await db.PatientHistories
            .FirstOrDefaultAsync(h => h.PatientId == patientId && !h.IsDeleted);

        return history is null ? null : ToResponse(history);
    }

    public async Task<MedicalRecordResponse> CreateMedicalRecordAsync(
        Guid patientId, Guid doctorId, Guid appointmentId, CreateMedicalRecordRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.ChiefComplaint))
            throw new ArgumentException("Şikayet alanı boş olamaz.");

        // PatientId randevudan çöz
        Guid resolvedPatientId = patientId;
        if (resolvedPatientId == Guid.Empty && appointmentId != Guid.Empty)
        {
            var appt = await db.Appointments.FindAsync(appointmentId)
                ?? throw new KeyNotFoundException("Randevu bulunamadı.");
            resolvedPatientId = appt.PatientId;
        }

        var record = new MedicalRecord
        {
            PatientId      = resolvedPatientId,
            DoctorId       = doctorId,
            AppointmentId  = appointmentId == Guid.Empty ? null : appointmentId,
            ChiefComplaint = request.ChiefComplaint,
            Findings       = request.Findings,
            Diagnosis      = request.Diagnosis,
            TreatmentPlan  = request.TreatmentPlan,
            IcdCode        = request.IcdCode
        };

        db.MedicalRecords.Add(record);
        await db.SaveChangesAsync();

        var doctor = await db.Doctors.FindAsync(doctorId);
        return ToResponse(record, doctor?.FullName ?? "");
    }

    public async Task<List<MedicalRecordResponse>> GetMedicalRecordsAsync(Guid patientId)
    {
        var records = await db.MedicalRecords
            .Include(r => r.Doctor)
            .Where(r => r.PatientId == patientId && !r.IsDeleted)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync();

        return records.Select(r => ToResponse(r, r.Doctor.FullName)).ToList();
    }

    public async Task<MeasurementResponse> AddMeasurementAsync(Guid patientId, CreateMeasurementRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Value))
            throw new ArgumentException("Ölçüm değeri boş olamaz.");

        var measurement = new Measurement
        {
            PatientId  = patientId,
            Type       = request.Type,
            Value      = request.Value,
            Unit       = request.Unit,
            MeasuredAt = request.MeasuredAt?.ToUniversalTime() ?? DateTime.UtcNow
        };

        db.Measurements.Add(measurement);
        await db.SaveChangesAsync();
        return ToResponse(measurement);
    }

    public async Task<List<MeasurementResponse>> GetMeasurementsAsync(Guid patientId, MeasurementType? type)
    {
        var query = db.Measurements
            .Where(m => m.PatientId == patientId && !m.IsDeleted);

        if (type.HasValue)
            query = query.Where(m => m.Type == type.Value);

        var measurements = await query
            .OrderByDescending(m => m.MeasuredAt)
            .ToListAsync();

        return measurements.Select(ToResponse).ToList();
    }

    // ── Mappers ───────────────────────────────────────────────────
    private static PatientHistoryResponse ToResponse(PatientHistory h) => new(
        h.Id, h.PatientId, h.ChronicDiseases, h.Allergies,
        h.FamilyHistory, h.PreviousSurgeries, h.CurrentMedications,
        h.BloodType, h.UpdatedAt);

    private static MedicalRecordResponse ToResponse(MedicalRecord r, string doctorName) => new(
        r.Id, r.PatientId, r.DoctorId, doctorName, r.AppointmentId,
        r.ChiefComplaint, r.Findings, r.Diagnosis, r.TreatmentPlan,
        r.IcdCode, r.CreatedAt);

    private static MeasurementResponse ToResponse(Measurement m) => new(
        m.Id, m.PatientId, m.Type, m.Value, m.Unit, m.MeasuredAt);
}
