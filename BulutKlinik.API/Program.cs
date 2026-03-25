using System.Text;
using BulutKlinik.API.Middleware;
using BulutKlinik.Core.Interfaces;
using BulutKlinik.Infrastructure.Persistence;
using BulutKlinik.Infrastructure.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

// ── PostgreSQL ────────────────────────────────────────────────────
builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseNpgsql(
        builder.Configuration.GetConnectionString("Default"),
        npgsql => npgsql.MigrationsAssembly("BulutKlinik.Infrastructure")));

// ── JWT Auth ──────────────────────────────────────────────────────
var jwtKey = builder.Configuration["Jwt:Key"]
    ?? throw new InvalidOperationException("Jwt:Key konfigürasyonu eksik.");

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opt =>
    {
        opt.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer           = true,
            ValidateAudience         = true,
            ValidateLifetime         = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer              = builder.Configuration["Jwt:Issuer"],
            ValidAudience            = builder.Configuration["Jwt:Issuer"],
            IssuerSigningKey         = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ClockSkew                = TimeSpan.Zero
        };
    });

builder.Services.AddAuthorization();

// ── DI ────────────────────────────────────────────────────────────
builder.Services.AddScoped<IAuthService,          AuthService>();
builder.Services.AddScoped<IScheduleService,      ScheduleService>();
builder.Services.AddScoped<ISlotGeneratorService, SlotGeneratorService>();
builder.Services.AddScoped<IAppointmentService,   AppointmentService>();
builder.Services.AddScoped<IMedicalService,       MedicalService>();
builder.Services.AddScoped<IInvoiceService,       InvoiceService>();
builder.Services.AddScoped<IStockService,         StockService>();
builder.Services.AddScoped<IDocumentService,      DocumentService>();
builder.Services.AddScoped<INotificationService,  NotificationService>();
builder.Services.AddScoped<IDashboardService,     DashboardService>();
builder.Services.AddScoped<IPackageService,       PackageService>();
builder.Services.AddScoped<IConsentService,       ConsentService>();
builder.Services.AddScoped<ITeamService,          TeamService>();

// ── Controllers ───────────────────────────────────────────────────
builder.Services.AddControllers()
    .AddJsonOptions(opt =>
    {
        // Enum'ları string olarak serialize et
        opt.JsonSerializerOptions.Converters.Add(
            new System.Text.Json.Serialization.JsonStringEnumConverter());
    });

// ── Swagger ───────────────────────────────────────────────────────
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "BulutKlinik API", Version = "v1" });

    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name        = "Authorization",
        Type        = SecuritySchemeType.Http,
        Scheme      = "bearer",
        BearerFormat = "JWT",
        In          = ParameterLocation.Header,
        Description = "JWT token giriniz. Örnek: eyJhbGci..."
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {{
        new OpenApiSecurityScheme
        {
            Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
        },
        Array.Empty<string>()
    }});
});

// ── CORS ──────────────────────────────────────────────────────────
builder.Services.AddCors(opt => opt.AddPolicy("Dev", p =>
    p.WithOrigins(
        "http://localhost:5173",   // Vite
        "http://localhost:3000")   // CRA
     .AllowAnyHeader()
     .AllowAnyMethod()));

var app = builder.Build();

// ── Middleware pipeline ───────────────────────────────────────────
app.UseMiddleware<GlobalExceptionMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "BulutKlinik v1"));
}

app.UseCors("Dev");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// ── Migration otomatik uygula (dev) ──────────────────────────────
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();
}

app.Run();
