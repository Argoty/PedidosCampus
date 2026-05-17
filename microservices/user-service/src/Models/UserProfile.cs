using System;
using System.ComponentModel.DataAnnotations;

namespace PedidosCampus.UserService.Models;

/// <summary>
/// Perfil de usuario o repartidor. Referencia lógica a userId en Auth Service
/// sin FK entre microservicios.
/// </summary>
public class UserProfile
{
    /// <summary>ID único del perfil</summary>
    [Key]
    public Guid Id { get; set; }

    /// <summary>Referencia a UserId en Auth Service (lógica, sin FK)</summary>
    [Required]
    public Guid UserId { get; set; }

    /// <summary>Tipo de usuario: usuario o repartidor</summary>
    [Required]
    [MaxLength(20)]
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

    /// <summary>Disponibilidad (aplica principalmente para repartidor)</summary>
    public bool Disponible { get; set; } = false;

    /// <summary>Estado del perfil (activo/inactivo)</summary>
    public bool IsActive { get; set; } = true;

    /// <summary>Fecha/hora hasta la que el repartidor está reservado (para evitar race conditions)</summary>
    public DateTime? ReservedUntil { get; set; }

    /// <summary>Fecha de creación</summary>
    public DateTime CreatedAt { get; set; }

    /// <summary>Fecha de última actualización</summary>
    public DateTime UpdatedAt { get; set; }
}
