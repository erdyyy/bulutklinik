FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY ["BulutKlinik.API/BulutKlinik.API.csproj", "BulutKlinik.API/"]
COPY ["BulutKlinik.Core/BulutKlinik.Core.csproj", "BulutKlinik.Core/"]
COPY ["BulutKlinik.Infrastructure/BulutKlinik.Infrastructure.csproj", "BulutKlinik.Infrastructure/"]

RUN dotnet restore "BulutKlinik.API/BulutKlinik.API.csproj"

COPY . .
WORKDIR "/src/BulutKlinik.API"
RUN dotnet build "BulutKlinik.API.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "BulutKlinik.API.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "BulutKlinik.API.dll"]
