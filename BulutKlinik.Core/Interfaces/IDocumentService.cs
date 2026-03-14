using BulutKlinik.Core.DTOs.Documents;

namespace BulutKlinik.Core.Interfaces;

public interface IDocumentService
{
    Task<DocumentDto> UploadAsync(Guid patientId, UploadDocumentRequest req);
    Task<IEnumerable<DocumentDto>> GetByPatientAsync(Guid patientId);
    Task<DocumentDto> GetByIdAsync(Guid id);
}
