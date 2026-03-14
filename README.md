# BulutKlinik — Klinik Otomasyon API

ASP.NET Core 8 + PostgreSQL + React ile geliştirilmekte olan klinik otomasyon sistemi.

## Teknoloji Yığını

| Katman | Teknoloji |
|--------|-----------|
| Backend | ASP.NET Core 8 Web API |
| ORM | Entity Framework Core 8 |
| Veritabanı | PostgreSQL 16 |
| Cache | Redis 7 |
| Auth | JWT Bearer |
| Frontend | React + TypeScript + Tailwind |

## Hızlı Başlangıç

### 1. Gereksinimler
- [.NET 8 SDK](https://dotnet.microsoft.com/download)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Node.js 20+](https://nodejs.org/)

### 2. Veritabanını başlat
```bash
docker-compose up postgres redis -d
```

### 3. Migration uygula
```bash
cd BulutKlinik.Infrastructure
dotnet ef migrations add InitialCreate --startup-project ../BulutKlinik.API
dotnet ef database update --startup-project ../BulutKlinik.API
```

### 4. API'yi çalıştır
```bash
cd BulutKlinik.API
dotnet run
# → http://localhost:5000/swagger
```

### 5. Docker ile tüm sistemi çalıştır
```bash
docker-compose up --build
# API: http://localhost:8080/swagger
```

## API Endpoint'leri

### Auth
| Method | URL | Açıklama |
|--------|-----|----------|
| POST | `/api/auth/register` | Kullanıcı kaydı |
| POST | `/api/auth/login` | Giriş — JWT döner |

### Randevu
| Method | URL | Auth | Açıklama |
|--------|-----|------|----------|
| GET | `/api/appointments/slots?doctorId=&date=` | — | Müsait slotlar |
| POST | `/api/appointments` | Patient | Randevu oluştur |
| GET | `/api/appointments/doctor/{id}?date=` | Doctor | Doktor randevuları |
| GET | `/api/appointments/my` | Patient | Hasta randevuları |
| PATCH | `/api/appointments/{id}/status` | Auth | Durum güncelle |

### Çalışma Takvimi
| Method | URL | Auth | Açıklama |
|--------|-----|------|----------|
| GET | `/api/doctors/{id}/schedules` | — | Takvim listesi |
| PUT | `/api/doctors/{id}/schedules` | Doctor | Gün upsert |
| DELETE | `/api/doctors/{id}/schedules/{sid}` | Doctor | Gün sil |
| GET | `/api/doctors/{id}/schedules/leaves` | — | İzin listesi |
| POST | `/api/doctors/{id}/schedules/leaves` | Doctor | İzin ekle |
| DELETE | `/api/doctors/{id}/schedules/leaves/{lid}` | Doctor | İzin sil |

## Proje Yapısı

```
BulutKlinik/
├── BulutKlinik.Core/          # Entity, DTO, Interface (bağımsız katman)
│   ├── Entities/
│   ├── DTOs/
│   └── Interfaces/
├── BulutKlinik.Infrastructure/ # EF Core, Service implementasyonları
│   ├── Persistence/
│   └── Services/
├── BulutKlinik.API/           # Controller, Middleware, Program.cs
│   ├── Controllers/
│   └── Middleware/
└── docker-compose.yml
```

## Sprint Durumu

- [x] Sprint 1 — Auth, WorkingSchedule, DoctorLeave
- [x] Sprint 2 — SlotGenerator, Appointment CRUD
- [ ] Sprint 3 — SMS Bildirimleri (Hangfire), Doktor Takvim UI
