using System.ComponentModel.DataAnnotations;

namespace PedidosCampus.UserService.DTOs;

/// <summary>
/// Request para crear un nuevo perfil de usuario.
/// El userId se vincula automáticamente desde el JWT.
/// </summary>
public class CreateProfileRequest
{
    /// <summary>Tipo de perfil: usuario o repartidor</summary>
    [Required]
    public string Tipo { get; set; } = string.Empty;

    /// <summary>Nombre completo del usuario</summary>
    [Required]
    [MaxLength(255)]
    public string Nombre { get; set; } = string.Empty;

    /// <summary>Teléfono de contacto (opcional)</summary>
    [MaxLength(20)]
    public string? Telefono { get; set; }

    /// <summary>Dirección del usuario (opcional)</summary>
    [MaxLength(500)]
    public string? Direccion { get; set; }
}

/// <summary>
/// Request para actualizar un perfil existente (campos parciales).
/// </summary>
public class UpdateProfileRequest
{
    /// <summary>Nombre completo (opcional)</summary>
    [MaxLength(255)]
    public string? Nombre { get; set; }

    /// <summary>Teléfono (opcional)</summary>
    [MaxLength(20)]
    public string? Telefono { get; set; }

    /// <summary>Dirección (opcional)</summary>
    [MaxLength(500)]
    public string? Direccion { get; set; }

    /// <summary>Tipo de perfil - solo admin puede cambiar</summary>
    [MaxLength(20)]
    public string? Tipo { get; set; }
}

/// <summary>
/// Request para cambiar disponibilidad de repartidor.
/// </summary>
public class AvailabilityRequest
{
    /// <summary>Nuevo estado de disponibilidad</summary>
    [Required]
    public bool Disponible { get; set; }
}

/// <summary>
/// Request para reservar un perfil (atomically).
/// Usado por order-service para asignar repartidores.
/// </summary>
public class ReserveRequest
{
    /// <summary>Tiempo de vida de la reserva en segundos (default: 300)</summary>
    public int? TtlSeconds { get; set; } = 300;
}

/// <summary>
/// Response genérico para errores.
/// </summary>
public class ErrorResponse
{
    /// <summary>Código de error único</summary>
    public string Code { get; set; } = string.Empty;

    /// <summary>Mensaje legible para humanos</summary>
    public string Message { get; set; } = string.Empty;

    /// <summary>Detalles adicionales (opcional)</summary>
    public object? Details { get; set; }

    public ErrorResponse() { }

    public ErrorResponse(string code, string message, object? details = null)
    {
        Code = code;
        Message = message;
        Details = details;
    }
}

/// <summary>
/// Response con datos del perfil de usuario.
/// NO expone userId (referencia interna a Auth Service).
/// </summary>
public class UserProfileResponse
{
    /// <summary>ID único del perfil</summary>
    public Guid Id { get; set; }

    /// <summary>Tipo de usuario</summary>
    public string Tipo { get; set; } = string.Empty;

    /// <summary>Nombre completo</summary>
    public string Nombre { get; set; } = string.Empty;

    /// <summary>Teléfono (puede ser null)</summary>
    public string? Telefono { get; set; }

    /// <summary>Dirección (puede ser null)</summary>
    public string? Direccion { get; set; }

    /// <summary>Estado de disponibilidad</summary>
    public bool Disponible { get; set; }

    /// <summary>Estado activo/inactivo</summary>
    public bool IsActive { get; set; }

    /// <summary>Fecha hasta la cual está reservado (puede ser null)</summary>
    public DateTime? ReservedUntil { get; set; }

    /// <summary>Fecha de creación</summary>
    public DateTime CreatedAt { get; set; }

    /// <summary>Fecha de última actualización</summary>
    public DateTime UpdatedAt { get; set; }
}

/// <summary>
/// Response para operación de disponibilidad.
/// </summary>
public class AvailabilityResponse
{
    /// <summary>Estado de disponibilidad actual</summary>
    public bool Disponible { get; set; }

    /// <summary>Fecha hasta la cual está reservado</summary>
    public DateTime? ReservedUntil { get; set; }
}

/// <summary>
/// Response para reserva atómica.
/// </summary>
public class ReserveResponse
{
    /// <summary>ID del perfil reservado</summary>
    public Guid ProfileId { get; set; }

    /// <summary>Fecha/hora hasta la cual está reservado</summary>
    public DateTime ReservedUntil { get; set; }

    /// <summary>Estado de la reserva</summary>
    public string Status { get; set; } = "reserved";
}

/// <summary>
/// Response genérico para listados paginados.
/// </summary>
public class PaginatedResponse<T>
{
    /// <summary>Items en esta página</summary>
    public List<T> Items { get; set; } = new();

    /// <summary>Offset de la búsqueda</summary>
    public int Offset { get; set; }

    /// <summary>Cantidad de items en esta página</summary>
    public int Limit { get; set; }

    /// <summary>Total de items disponibles</summary>
    public int Total { get; set; }

    public PaginatedResponse() { }

    public PaginatedResponse(List<T> items, int offset, int limit, int total)
    {
        Items = items;
        Offset = offset;
        Limit = limit;
        Total = total;
    }
}
