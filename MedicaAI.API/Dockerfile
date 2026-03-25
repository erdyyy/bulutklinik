FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY ["MedicaAI.API/MedicaAI.API.csproj", "MedicaAI.API/"]
COPY ["MedicaAI.Core/MedicaAI.Core.csproj", "MedicaAI.Core/"]
COPY ["MedicaAI.Infrastructure/MedicaAI.Infrastructure.csproj", "MedicaAI.Infrastructure/"]

RUN dotnet restore "MedicaAI.API/MedicaAI.API.csproj"

COPY . .
WORKDIR "/src/MedicaAI.API"
RUN dotnet build "MedicaAI.API.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "MedicaAI.API.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "MedicaAI.API.dll"]
