# Etapa 1: Build
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build

WORKDIR /app

# Copiar archivos de proyecto
COPY src/UserService.csproj ./src/
COPY Tests/UserService.Tests.csproj ./Tests/

# Restaurar dependencias
RUN dotnet restore ./src/UserService.csproj

# Copiar código fuente
COPY . ./

# Compilar la aplicación
RUN dotnet build ./src/UserService.csproj -c Release -o /app/build

# Publicar
RUN dotnet publish ./src/UserService.csproj -c Release -o /app/publish

# Etapa 2: Runtime
FROM mcr.microsoft.com/dotnet/aspnet:8.0

WORKDIR /app

# Copiar archivos publicados desde la etapa de build
COPY --from=build /app/publish .

# Exponer puerto (puede ser sobrescrito por docker-compose)
EXPOSE 5000

# Variables de entorno
ENV ASPNETCORE_URLS=http://+:5000
ENV ASPNETCORE_ENVIRONMENT=Production

# Punto de entrada
ENTRYPOINT ["dotnet", "UserService.dll"]
