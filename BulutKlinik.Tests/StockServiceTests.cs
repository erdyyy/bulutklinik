using BulutKlinik.Core.DTOs.Stock;
using BulutKlinik.Core.Entities;
using BulutKlinik.Infrastructure.Persistence;
using BulutKlinik.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;

namespace BulutKlinik.Tests;

public class StockServiceTests : IDisposable
{
    private readonly AppDbContext _db;
    private readonly StockService _sut;
    private readonly Guid _patientId = Guid.NewGuid();

    public StockServiceTests()
    {
        var opts = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _db  = new AppDbContext(opts);
        _sut = new StockService(_db);

        _db.Users.Add(new User { Id = _patientId, Email = "hasta@test.com", PasswordHash = "x", PhoneNumber = "0", Role = UserRole.Patient });
        _db.SaveChanges();
    }

    // ── Doküman ───────────────────────────────────────────────────

    [Fact]
    public async Task UploadDocument_GecerliVeri_KayitOlusturulmali()
    {
        var req = new CreateDocumentRequest(null, "lab_sonuc.pdf", "application/pdf",
            Convert.ToBase64String(new byte[] { 1, 2, 3 }), DocumentCategory.LabResult);

        var result = await _sut.UploadDocumentAsync(_patientId, req);

        Assert.Equal("lab_sonuc.pdf", result.FileName);
        Assert.Equal(DocumentCategory.LabResult, result.Category);
        Assert.Equal(_patientId, result.PatientId);
    }

    [Fact]
    public async Task UploadDocument_BosFileName_ArgumentException()
    {
        var req = new CreateDocumentRequest(null, "", "application/pdf", "base64data", DocumentCategory.Other);

        await Assert.ThrowsAsync<ArgumentException>(
            () => _sut.UploadDocumentAsync(_patientId, req));
    }

    [Fact]
    public async Task UploadDocument_BosBase64_ArgumentException()
    {
        var req = new CreateDocumentRequest(null, "file.pdf", "application/pdf", "", DocumentCategory.Other);

        await Assert.ThrowsAsync<ArgumentException>(
            () => _sut.UploadDocumentAsync(_patientId, req));
    }

    [Fact]
    public async Task GetDocuments_HastaninDokumanlarini_Listeler()
    {
        var base64 = Convert.ToBase64String(new byte[] { 1 });
        await _sut.UploadDocumentAsync(_patientId, new CreateDocumentRequest(null, "a.pdf", "pdf", base64, DocumentCategory.Consent));
        await _sut.UploadDocumentAsync(_patientId, new CreateDocumentRequest(null, "b.pdf", "pdf", base64, DocumentCategory.Prescription));

        var result = await _sut.GetDocumentsAsync(_patientId);

        Assert.Equal(2, result.Count);
    }

    [Fact]
    public async Task DownloadDocument_MevcutDokuman_Base64DonduruluMali()
    {
        var base64 = Convert.ToBase64String(new byte[] { 10, 20, 30 });
        var uploaded = await _sut.UploadDocumentAsync(_patientId,
            new CreateDocumentRequest(null, "sonuc.pdf", "pdf", base64, DocumentCategory.LabResult));

        var result = await _sut.DownloadDocumentAsync(uploaded.Id);

        Assert.Equal("sonuc.pdf", result.FileName);
        Assert.Equal(base64, result.FileBase64);
    }

    [Fact]
    public async Task DownloadDocument_YokDokuman_KeyNotFoundException()
    {
        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => _sut.DownloadDocumentAsync(Guid.NewGuid()));
    }

    // ── StockItem ─────────────────────────────────────────────────

    [Fact]
    public async Task CreateStockItem_GecerliVeri_SifirMiktarlaBaslar()
    {
        var req = new StockItemRequest("Enjektör", "Sarf", "Adet", 50, null, 2.5m);

        var result = await _sut.CreateStockItemAsync(req);

        Assert.Equal("Enjektör", result.Name);
        Assert.Equal(0, result.CurrentQuantity);  // Başlangıçta sıfır
        Assert.Equal(50, result.MinimumQuantity);
        Assert.True(result.IsLow);  // 0 <= 50 → düşük stok
    }

    [Fact]
    public async Task CreateStockItem_BosAd_ArgumentException()
    {
        var req = new StockItemRequest("", "Sarf", "Adet", 10, null, 1m);

        await Assert.ThrowsAsync<ArgumentException>(
            () => _sut.CreateStockItemAsync(req));
    }

    [Fact]
    public async Task AddMovement_GirisHareketi_MiktarArtar()
    {
        var item = await _sut.CreateStockItemAsync(new StockItemRequest("İğne", "Sarf", "Adet", 20, null, 1m));

        await _sut.AddMovementAsync(item.Id, new StockMovementRequest(StockMovementType.In, 100, "İlk giriş"));

        var updated = (await _sut.GetStockAsync()).First(s => s.Id == item.Id);
        Assert.Equal(100, updated.CurrentQuantity);
        Assert.False(updated.IsLow);
    }

    [Fact]
    public async Task AddMovement_CikisHareketi_MiktarAzalir()
    {
        var item = await _sut.CreateStockItemAsync(new StockItemRequest("Pamuk", "Sarf", "Paket", 5, null, 3m));
        await _sut.AddMovementAsync(item.Id, new StockMovementRequest(StockMovementType.In, 50, "Giriş"));

        await _sut.AddMovementAsync(item.Id, new StockMovementRequest(StockMovementType.Out, 10, "Kullanım"));

        var updated = (await _sut.GetStockAsync()).First(s => s.Id == item.Id);
        Assert.Equal(40, updated.CurrentQuantity);
    }

    [Fact]
    public async Task AddMovement_IadeHareketi_MiktarArtar()
    {
        var item = await _sut.CreateStockItemAsync(new StockItemRequest("Eldiven", "Sarf", "Kutu", 5, null, 15m));
        await _sut.AddMovementAsync(item.Id, new StockMovementRequest(StockMovementType.In, 30, null));
        await _sut.AddMovementAsync(item.Id, new StockMovementRequest(StockMovementType.Out, 10, null));

        await _sut.AddMovementAsync(item.Id, new StockMovementRequest(StockMovementType.Return, 3, "İade"));

        var updated = (await _sut.GetStockAsync()).First(s => s.Id == item.Id);
        Assert.Equal(23, updated.CurrentQuantity); // 30 - 10 + 3
    }

    [Fact]
    public async Task AddMovement_YetersizStok_InvalidOperationException()
    {
        var item = await _sut.CreateStockItemAsync(new StockItemRequest("İlaç", "Farma", "Kutu", 5, null, 100m));
        await _sut.AddMovementAsync(item.Id, new StockMovementRequest(StockMovementType.In, 10, null));

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => _sut.AddMovementAsync(item.Id, new StockMovementRequest(StockMovementType.Out, 15, null)));
    }

    [Fact]
    public async Task AddMovement_SifirMiktar_ArgumentException()
    {
        var item = await _sut.CreateStockItemAsync(new StockItemRequest("Test", null, "Adet", 0, null, 1m));

        await Assert.ThrowsAsync<ArgumentException>(
            () => _sut.AddMovementAsync(item.Id, new StockMovementRequest(StockMovementType.In, 0, null)));
    }

    [Fact]
    public async Task GetLowStock_MinimumAltindakiler_Listelenmeli()
    {
        var item1 = await _sut.CreateStockItemAsync(new StockItemRequest("A", null, "Adet", 100, null, 1m));
        var item2 = await _sut.CreateStockItemAsync(new StockItemRequest("B", null, "Adet", 50, null, 1m));
        // item1'e 150 giriş → normal stok
        await _sut.AddMovementAsync(item1.Id, new StockMovementRequest(StockMovementType.In, 150, null));
        // item2'ye 10 giriş → düşük stok (10 <= 50)

        var low = await _sut.GetLowStockAsync();

        var ids = low.Select(s => s.Id).ToList();
        Assert.DoesNotContain(item1.Id, ids); // 150 > 100 → normal
        Assert.Contains(item2.Id, ids);       // 0 <= 50 → düşük
    }

    public void Dispose() => _db.Dispose();
}
