using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using PedidosCampus.UserService.Data;
using PedidosCampus.UserService.DTOs;
using PedidosCampus.UserService.Models;

namespace PedidosCampus.UserService.Services;

/// <summary>
/// Implementación de servicios para gestión de perfiles.
/// Incluye lógica de negocio, validaciones y operaciones atómicas.
/// </summary>
public class ProfileService : IProfileService
{
    private readonly UserServiceDbContext _context;
    private readonly ILogger<ProfileService> _logger;

    public ProfileService(UserServiceDbContext context, ILogger<ProfileService> logger)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    // ===== Operaciones de perfil propio =====

    public async Task<UserProfileResponse?> GetMyProfileAsync(Guid userId)
    {
        _logger.LogInformation("Getting profile for userId: {UserId}", userId);

        var profile = await _context.UserProfiles
            .FirstOrDefaultAsync(p => p.UserId == userId && p.IsActive);

        return profile != null ? MapToResponse(profile) : null;
    }

    public async Task<UserProfileResponse> CreateProfileAsync(
        Guid userId,
        string tipo,
        string nombre,
        string? telefono,
        string? direccion)
    {
        _logger.LogInformation("Creating profile for userId: {UserId}, tipo: {Tipo}", userId, tipo);

        // Validar que no exista perfil previo
        var existingProfile = await _context.UserProfiles
            .FirstOrDefaultAsync(p => p.UserId == userId);

        if (existingProfile != null)
            throw new InvalidOperationException($"Profile already exists for userId: {userId}");

        // Validar tipo
        if (tipo != "usuario" && tipo != "repartidor")
            throw new ArgumentException($"Invalid tipo: {tipo}. Must be 'usuario' or 'repartidor'.");

        var profile = new UserProfile
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Tipo = tipo,
            Nombre = nombre,
            Telefono = telefono,
            Direccion = direccion,
            Disponible = false,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.UserProfiles.Add(profile);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Profile created: {ProfileId}", profile.Id);
        return MapToResponse(profile);
    }

    public async Task<UserProfileResponse?> UpdateMyProfileAsync(Guid userId, UpdateProfileRequest request)
    {
        _logger.LogInformation("Updating profile for userId: {UserId}", userId);

        var profile = await _context.UserProfiles
            .FirstOrDefaultAsync(p => p.UserId == userId && p.IsActive);

        if (profile == null)
            return null;

        // Actualizar campos disponibles
        if (!string.IsNullOrEmpty(request.Nombre))
            profile.Nombre = request.Nombre;

        if (request.Telefono != null)
            profile.Telefono = request.Telefono;

        if (request.Direccion != null)
            profile.Direccion = request.Direccion;

        profile.UpdatedAt = DateTime.UtcNow;

        _context.UserProfiles.Update(profile);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Profile updated: {ProfileId}", profile.Id);
        return MapToResponse(profile);
    }

    // ===== Disponibilidad (repartidor) =====

    public async Task<AvailabilityResponse?> SetAvailabilityAsync(Guid userId, bool disponible)
    {
        _logger.LogInformation("Setting availability for userId: {UserId}, disponible: {Disponible}", userId, disponible);

        var profile = await _context.UserProfiles
            .FirstOrDefaultAsync(p => p.UserId == userId && p.IsActive);

        if (profile == null)
            return null;

        if (profile.Tipo != "repartidor")
            throw new InvalidOperationException("Only delivery profiles can change availability");

        profile.Disponible = disponible;
        // Si se marca como no disponible, limpiar la reserva
        if (!disponible)
            profile.ReservedUntil = null;

        profile.UpdatedAt = DateTime.UtcNow;

        _context.UserProfiles.Update(profile);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Availability updated for profile: {ProfileId}", profile.Id);

        return new AvailabilityResponse
        {
            Disponible = profile.Disponible,
            ReservedUntil = profile.ReservedUntil
        };
    }

    public async Task<AvailabilityResponse?> GetMyAvailabilityAsync(Guid userId)
    {
        _logger.LogInformation("Getting availability for userId: {UserId}", userId);

        var profile = await _context.UserProfiles
            .FirstOrDefaultAsync(p => p.UserId == userId && p.IsActive);

        if (profile == null)
            return null;

        return new AvailabilityResponse
        {
            Disponible = profile.Disponible,
            ReservedUntil = profile.ReservedUntil
        };
    }

    // ===== Operaciones admin =====

    public async Task<PaginatedResponse<UserProfileResponse>> ListProfilesAsync(
        string? tipo = null,
        bool? isActive = null,
        int offset = 0,
        int limit = 10)
    {
        _logger.LogInformation("Listing profiles: tipo={Tipo}, isActive={IsActive}, offset={Offset}, limit={Limit}",
            tipo, isActive, offset, limit);

        var query = _context.UserProfiles.AsQueryable();

        if (!string.IsNullOrEmpty(tipo))
            query = query.Where(p => p.Tipo == tipo);

        if (isActive.HasValue)
            query = query.Where(p => p.IsActive == isActive.Value);

        var total = await query.CountAsync();
        var profiles = await query
            .OrderByDescending(p => p.CreatedAt)
            .Skip(offset)
            .Take(limit)
            .ToListAsync();

        return new PaginatedResponse<UserProfileResponse>(
            profiles.Select(MapToResponse).ToList(),
            offset,
            limit,
            total);
    }

    public async Task<UserProfileResponse?> GetProfileByIdAsync(Guid profileId)
    {
        _logger.LogInformation("Getting profile by ID: {ProfileId}", profileId);

        var profile = await _context.UserProfiles
            .FirstOrDefaultAsync(p => p.Id == profileId);

        return profile != null ? MapToResponse(profile) : null;
    }

    public async Task<UserProfileResponse?> GetProfileByUserIdAsync(Guid userId)
    {
        _logger.LogInformation("Getting profile by userId: {UserId}", userId);

        var profile = await _context.UserProfiles
            .FirstOrDefaultAsync(p => p.UserId == userId && p.IsActive);

        return profile != null ? MapToResponse(profile) : null;
    }

    public async Task<UserProfileResponse?> UpdateProfileByIdAsync(Guid profileId, UpdateProfileRequest request)
    {
        _logger.LogInformation("Updating profile by ID (admin): {ProfileId}", profileId);

        var profile = await _context.UserProfiles
            .FirstOrDefaultAsync(p => p.Id == profileId);

        if (profile == null)
            return null;

        if (!string.IsNullOrEmpty(request.Nombre))
            profile.Nombre = request.Nombre;

        if (request.Telefono != null)
            profile.Telefono = request.Telefono;

        if (request.Direccion != null)
            profile.Direccion = request.Direccion;

        if (!string.IsNullOrEmpty(request.Tipo))
            profile.Tipo = request.Tipo;

        profile.UpdatedAt = DateTime.UtcNow;

        _context.UserProfiles.Update(profile);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Profile updated by admin: {ProfileId}", profile.Id);
        return MapToResponse(profile);
    }

    public async Task<bool> DeactivateProfileAsync(Guid profileId)
    {
        _logger.LogInformation("Deactivating profile: {ProfileId}", profileId);

        var profile = await _context.UserProfiles.FirstOrDefaultAsync(p => p.Id == profileId);
        if (profile == null)
            return false;

        profile.IsActive = false;
        profile.Disponible = false;
        profile.UpdatedAt = DateTime.UtcNow;

        _context.UserProfiles.Update(profile);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Profile deactivated: {ProfileId}", profile.Id);
        return true;
    }

    public async Task<bool> ActivateProfileAsync(Guid profileId)
    {
        _logger.LogInformation("Activating profile: {ProfileId}", profileId);

        var profile = await _context.UserProfiles.FirstOrDefaultAsync(p => p.Id == profileId);
        if (profile == null)
            return false;

        profile.IsActive = true;
        profile.UpdatedAt = DateTime.UtcNow;

        _context.UserProfiles.Update(profile);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Profile activated: {ProfileId}", profile.Id);
        return true;
    }

    public async Task<bool> DeleteProfileAsync(Guid profileId)
    {
        _logger.LogInformation("Deleting profile: {ProfileId}", profileId);

        var profile = await _context.UserProfiles.FirstOrDefaultAsync(p => p.Id == profileId);
        if (profile == null)
            return false;

        _context.UserProfiles.Remove(profile);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Profile deleted: {ProfileId}", profile.Id);
        return true;
    }

    // ===== Operaciones internal (Gateway/Order Service) =====

    public async Task<PaginatedResponse<UserProfileResponse>> ListAvailableDeliveryAsync(
        bool onlyAvailable = true,
        int offset = 0,
        int limit = 10)
    {
        _logger.LogInformation("Listing available delivery profiles: onlyAvailable={OnlyAvailable}, offset={Offset}, limit={Limit}",
            onlyAvailable, offset, limit);

        var query = _context.UserProfiles
            .Where(p => p.Tipo == "repartidor" && p.IsActive);

        if (onlyAvailable)
            query = query.Where(p => p.Disponible && (p.ReservedUntil == null || p.ReservedUntil <= DateTime.UtcNow));

        var total = await query.CountAsync();
        var profiles = await query
            .OrderByDescending(p => p.Disponible)
            .ThenBy(p => p.ReservedUntil)
            .Skip(offset)
            .Take(limit)
            .ToListAsync();

        return new PaginatedResponse<UserProfileResponse>(
            profiles.Select(MapToResponse).ToList(),
            offset,
            limit,
            total);
    }

    public async Task<PaginatedResponse<UserProfileResponse>> SearchProfilesAsync(
        string? tipo = null,
        bool? disponible = null,
        int offset = 0,
        int limit = 10)
    {
        _logger.LogInformation("Searching profiles: tipo={Tipo}, disponible={Disponible}, offset={Offset}, limit={Limit}",
            tipo, disponible, offset, limit);

        var query = _context.UserProfiles.Where(p => p.IsActive);

        if (!string.IsNullOrEmpty(tipo))
            query = query.Where(p => p.Tipo == tipo);

        if (disponible.HasValue)
            query = query.Where(p => p.Disponible == disponible.Value);

        var total = await query.CountAsync();
        var profiles = await query
            .OrderByDescending(p => p.CreatedAt)
            .Skip(offset)
            .Take(limit)
            .ToListAsync();

        return new PaginatedResponse<UserProfileResponse>(
            profiles.Select(MapToResponse).ToList(),
            offset,
            limit,
            total);
    }

    public async Task<ReserveResponse?> ReserveProfileAtomicAsync(Guid profileId, int ttlSeconds = 300)
    {
        _logger.LogInformation("Attempting atomic reserve for profile: {ProfileId}, ttl: {TtlSeconds}", profileId, ttlSeconds);

        var profile = await _context.UserProfiles.FirstOrDefaultAsync(p => p.Id == profileId);

        if (profile == null)
        {
            _logger.LogWarning("Profile not found for reserve: {ProfileId}", profileId);
            return null;
        }

        // Verificar condiciones atómicas
        var now = DateTime.UtcNow;
        if (!profile.Disponible || (profile.ReservedUntil != null && profile.ReservedUntil > now))
        {
            _logger.LogWarning("Profile reserve failed - not available or already reserved: {ProfileId}", profileId);
            return null;
        }

        // Actualizar con nuevo tiempo de reserva
        profile.ReservedUntil = now.AddSeconds(ttlSeconds);
        profile.UpdatedAt = now;

        try
        {
            _context.UserProfiles.Update(profile);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Profile reserved successfully: {ProfileId}, until: {ReservedUntil}",
                profileId, profile.ReservedUntil);

            return new ReserveResponse
            {
                ProfileId = profileId,
                ReservedUntil = profile.ReservedUntil.Value,
                Status = "reserved"
            };
        }
        catch (DbUpdateConcurrencyException ex)
        {
            _logger.LogWarning(ex, "Concurrency conflict during reserve for profile: {ProfileId}", profileId);
            return null;
        }
    }

    public async Task<bool> ReleaseReservationAsync(Guid profileId)
    {
        _logger.LogInformation("Releasing reservation for profile: {ProfileId}", profileId);

        var profile = await _context.UserProfiles.FirstOrDefaultAsync(p => p.Id == profileId);

        if (profile == null)
            return false;

        profile.ReservedUntil = null;
        profile.UpdatedAt = DateTime.UtcNow;

        _context.UserProfiles.Update(profile);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Reservation released: {ProfileId}", profile.Id);
        return true;
    }

    // ===== Helper methods =====

    private static UserProfileResponse MapToResponse(UserProfile profile)
    {
        return new UserProfileResponse
        {
            Id = profile.Id,
            Tipo = profile.Tipo,
            Nombre = profile.Nombre,
            Telefono = profile.Telefono,
            Direccion = profile.Direccion,
            Disponible = profile.Disponible,
            IsActive = profile.IsActive,
            ReservedUntil = profile.ReservedUntil,
            CreatedAt = profile.CreatedAt,
            UpdatedAt = profile.UpdatedAt
        };
    }
}
