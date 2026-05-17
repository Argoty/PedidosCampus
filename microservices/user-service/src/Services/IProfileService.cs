using PedidosCampus.UserService.DTOs;
using PedidosCampus.UserService.Models;

namespace PedidosCampus.UserService.Services;

/// <summary>
/// Contrato de servicios para gestión de perfiles de usuario y repartidor.
/// </summary>
public interface IProfileService
{
    // === Operaciones de perfil propio ===

    /// <summary>Obtener perfil del usuario autenticado</summary>
    Task<UserProfileResponse?> GetMyProfileAsync(Guid userId);

    /// <summary>Crear un nuevo perfil para el usuario autenticado</summary>
    Task<UserProfileResponse> CreateProfileAsync(Guid userId, string tipo, string nombre, string? telefono, string? direccion);

    /// <summary>Actualizar perfil del usuario autenticado</summary>
    Task<UserProfileResponse?> UpdateMyProfileAsync(Guid userId, UpdateProfileRequest request);

    // === Disponibilidad (repartidor) ===

    /// <summary>Cambiar disponibilidad del repartidor</summary>
    Task<AvailabilityResponse?> SetAvailabilityAsync(Guid userId, bool disponible);

    /// <summary>Obtener disponibilidad del repartidor autenticado</summary>
    Task<AvailabilityResponse?> GetMyAvailabilityAsync(Guid userId);

    // === Operaciones admin ===

    /// <summary>Listar perfiles con filtros (admin)</summary>
    Task<PaginatedResponse<UserProfileResponse>> ListProfilesAsync(
        string? tipo = null,
        bool? isActive = null,
        int offset = 0,
        int limit = 10);

    /// <summary>Obtener perfil por ID (admin o propietario)</summary>
    Task<UserProfileResponse?> GetProfileByIdAsync(Guid profileId);

    /// <summary>Obtener perfil por userId</summary>
    Task<UserProfileResponse?> GetProfileByUserIdAsync(Guid userId);

    /// <summary>Actualizar perfil por ID (admin)</summary>
    Task<UserProfileResponse?> UpdateProfileByIdAsync(Guid profileId, UpdateProfileRequest request);

    /// <summary>Desactivar perfil (admin)</summary>
    Task<bool> DeactivateProfileAsync(Guid profileId);

    /// <summary>Activar perfil (admin)</summary>
    Task<bool> ActivateProfileAsync(Guid profileId);

    /// <summary>Eliminar perfil (admin)</summary>
    Task<bool> DeleteProfileAsync(Guid profileId);

    // === Operaciones internal (Gateway/Order Service) ===

    /// <summary>Listar repartidores disponibles (internal)</summary>
    Task<PaginatedResponse<UserProfileResponse>> ListAvailableDeliveryAsync(
        bool onlyAvailable = true,
        int offset = 0,
        int limit = 10);

    /// <summary>Búsqueda avanzada de perfiles (internal)</summary>
    Task<PaginatedResponse<UserProfileResponse>> SearchProfilesAsync(
        string? tipo = null,
        bool? disponible = null,
        int offset = 0,
        int limit = 10);

    /// <summary>Reservar perfil atómicamente (internal)</summary>
    /// <remarks>
    /// Intenta marcar reservedUntil = now + ttlSeconds solo si:
    /// - disponible = true
    /// - reservedUntil IS NULL OR reservedUntil <= now
    /// Devuelve null si la reserva falla (ya reservado/indisponible).
    /// </remarks>
    Task<ReserveResponse?> ReserveProfileAtomicAsync(Guid profileId, int ttlSeconds = 300);

    /// <summary>Liberar reserva de perfil (internal)</summary>
    Task<bool> ReleaseReservationAsync(Guid profileId);
}
