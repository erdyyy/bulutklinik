using MedicaAI.Core.DTOs.Consent;

namespace MedicaAI.Core.Interfaces;

public interface IConsentService
{
    Task<IEnumerable<ConsentRecordDto>> GetByDoctorAsync(Guid doctorId);
    Task<IEnumerable<ConsentRecordDto>> GetByPatientAsync(Guid patientId);
    Task<ConsentRecordDto> CreateAsync(CreateConsentRequest req);
}
