using MedicaAI.Core.DTOs.Documents;

namespace MedicaAI.Core.Interfaces;

public interface IDocumentService
{
    Task<DocumentDto> UploadAsync(Guid patientId, UploadDocumentRequest req);
    Task<IEnumerable<DocumentDto>> GetByPatientAsync(Guid patientId);
    Task<DocumentDto> GetByIdAsync(Guid id);
}
