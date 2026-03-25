using System.Text;
using MedicaAI.API.Middleware;
using MedicaAI.Core.DTOs.Auth;
using MedicaAI.Core.Entities;
using MedicaAI.Core.Interfaces;
using MedicaAI.Infrastructure.Persistence;
using MedicaAI.Infrastructure.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

// ── PostgreSQL ────────────────────────────────────────────────────
builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseNpgsql(
        builder.Configuration.GetConnectionString("Default"),
        npgsql => npgsql.MigrationsAssembly("MedicaAI.Infrastructure")));

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
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "Medica.AI API", Version = "v1" });

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
    app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "Medica.AI v1"));
}

app.UseCors("Dev");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// ── Migration + Seed ────────────────────────────────────────────
using (var scope = app.Services.CreateScope())
{
    var db   = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var auth = scope.ServiceProvider.GetRequiredService<IAuthService>();

    await db.Database.MigrateAsync();

    // Eski domain → yeni domain migration (varsa güncelle)
    var oldDoctor = await db.Users.FirstOrDefaultAsync(u => u.Email == "doktor@bulutklinik.com");
    if (oldDoctor != null) { oldDoctor.Email = "doktor@medica.ai"; await db.SaveChangesAsync(); }
    var oldHasta = await db.Users.FirstOrDefaultAsync(u => u.Email == "hasta@bulutklinik.com");
    if (oldHasta != null) { oldHasta.Email = "hasta@medica.ai"; await db.SaveChangesAsync(); }

    // Test Doktor
    if (!await db.Users.AnyAsync(u => u.Email == "doktor@medica.ai"))
    {
        var res = await auth.RegisterAsync(new RegisterRequest(
            Email:       "doktor@medica.ai",
            Password:    "Test1234",
            PhoneNumber: "05001234567",
            Role:        "Doctor"
        ));
        db.Doctors.Add(new Doctor
        {
            Id        = res.UserId,
            FullName  = "Dr. Ahmet Yılmaz",
            Title     = "Uzm. Dr.",
            Specialty = "Estetik ve Plastik Cerrahi",
        });
        await db.SaveChangesAsync();
    }

    // Test Hasta
    if (!await db.Users.AnyAsync(u => u.Email == "hasta@medica.ai"))
    {
        await auth.RegisterAsync(new RegisterRequest(
            Email:       "hasta@medica.ai",
            Password:    "Test1234",
            PhoneNumber: "05009876543",
            Role:        "Patient"
        ));
    }
}

app.Run();
