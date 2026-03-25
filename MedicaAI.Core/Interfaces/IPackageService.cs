using MedicaAI.Core.DTOs.Packages;

namespace MedicaAI.Core.Interfaces;

public interface IPackageService
{
    Task<IEnumerable<TreatmentPackageDto>> GetByDoctorAsync(Guid doctorId);
    Task<IEnumerable<TreatmentPackageDto>> GetByPatientAsync(Guid patientId);
    Task<TreatmentPackageDto> GetAsync(Guid id);
    Task<TreatmentPackageDto> CreateAsync(CreatePackageRequest req);
    Task<TreatmentPackageDto> CompleteSessionAsync(Guid packageId, CompleteSessionRequest req);
    Task DeleteAsync(Guid id);
}
