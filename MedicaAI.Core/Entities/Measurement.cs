namespace MedicaAI.Core.Entities;

public class Measurement
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid PatientId { get; set; }
    public MeasurementType Type { get; set; }
    public string Value { get; set; } = null!;
    public string Unit { get; set; } = null!;
    public bool IsDeleted { get; set; } = false;
    public DateTime MeasuredAt { get; set; } = DateTime.UtcNow;

    public User Patient { get; set; } = null!;
}

public enum MeasurementType { Weight, Height, BloodPressure, Temperature, HeartRate, SpO2 }
