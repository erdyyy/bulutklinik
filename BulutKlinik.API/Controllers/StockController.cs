using BulutKlinik.Core.DTOs.Stock;
using BulutKlinik.Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BulutKlinik.API.Controllers;

[ApiController]
[Route("api/stock")]
[Authorize(Roles = "Doctor,Staff")]
public class StockController(IStockService svc) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll() => Ok(await svc.GetAllAsync());

    [HttpPost]
    public async Task<IActionResult> Create(CreateStockItemRequest req) =>
        Ok(await svc.CreateAsync(req));

    [HttpPost("{id:guid}/movement")]
    public async Task<IActionResult> AddMovement(Guid id, AddMovementRequest req) =>
        Ok(await svc.AddMovementAsync(id, req));

    [HttpGet("low")]
    public async Task<IActionResult> GetLow() => Ok(await svc.GetLowStockAsync());
}
