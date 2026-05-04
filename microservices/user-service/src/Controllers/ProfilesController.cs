using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PedidosCampus.UserService.DTOs;
using PedidosCampus.UserService.Services;

namespace PedidosCampus.UserService.Controllers;

/// <summary>
/// API Controller para gestión de perfiles de usuario y repartidor.
/// Implementa todos los endpoints según API.md.
/// 
/// Roles:
/// - usuario, repartidor: acceso a endpoints de perfil propio
/// - admin: acceso a endpoints de administración
/// - internal: endpoints accesibles solo por API Gateway
/// </summary>
[ApiController]
[Route("api/profiles")]
[Produces("application/json")]
[Authorize]
public class ProfilesController : ControllerBase
{
    private readonly IProfileService _profileService;
    private readonly ILogger<ProfilesController> _logger;

    public ProfilesController(IProfileService profileService, ILogger<ProfilesController> logger)
    {
        _profileService = profileService ?? throw new ArgumentNullException(nameof(profileService));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    // ===== Endpoints Públicos/Autenticados =====

    /// <summary>
    /// 1) Obtener perfil propio del usuario autenticado.
    /// GET /api/profiles/me
    /// Roles: usuario, repartidor
    /// </summary>
    [HttpGet("me")]
    [Authorize(Roles = "usuario,repartidor,admin")]
    public async Task<ActionResult<UserProfileResponse>> GetMyProfile()
    {
        // TODO: Extraer userId del JWT (User.FindFirst("sub")?.Value)
        // Por ahora usamos un GUID de prueba para desarrollo
        var userId = User.FindFirst("sub")?.Value ?? throw new UnauthorizedAccessException("No subject claim in token");
        if (!Guid.TryParse(userId, out var userIdGuid))
            return Unauthorized(new ErrorResponse("INVALID_TOKEN", "Invalid userId in token"));

        _logger.LogInformation("GET /me - userId: {UserId}", userIdGuid);

        var profile = await _profileService.GetMyProfileAsync(userIdGuid);
        if (profile == null)
            return NotFound(new ErrorResponse("NOT_FOUND", "Profile not found"));

        return Ok(profile);
    }

    /// <summary>
    /// 2) Crear/Registrar nuevo perfil.
    /// POST /api/profiles
    /// Body: CreateProfileRequest
    /// Roles: autenticado
    /// </summary>
    [HttpPost]
    [Authorize(Roles = "usuario,repartidor,admin")]
    public async Task<ActionResult<UserProfileResponse>> CreateProfile([FromBody] CreateProfileRequest request)
    {
        if (!ModelState.IsValid)
            return BadRequest(new ErrorResponse("INVALID_REQUEST", "Request validation failed", ModelState));

        // TODO: Extraer userId del JWT
        var userId = User.FindFirst("sub")?.Value ?? throw new UnauthorizedAccessException("No subject claim in token");
        if (!Guid.TryParse(userId, out var userIdGuid))
            return Unauthorized(new ErrorResponse("INVALID_TOKEN", "Invalid userId in token"));

        _logger.LogInformation("POST / - Creating profile for userId: {UserId}, tipo: {Tipo}", userIdGuid, request.Tipo);

        try
        {
            var profile = await _profileService.CreateProfileAsync(
                userIdGuid,
                request.Tipo,
                request.Nombre,
                request.Telefono,
                request.Direccion);

            return CreatedAtAction(nameof(GetMyProfile), new { id = profile.Id }, profile);
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Profile already exists for userId: {UserId}", userIdGuid);
            return Conflict(new ErrorResponse("CONFLICT", ex.Message));
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "Invalid argument for profile creation");
            return BadRequest(new ErrorResponse("INVALID_ARGUMENT", ex.Message));
        }
    }

    /// <summary>
    /// 3) Actualizar perfil propio.
    /// PATCH /api/profiles/me
    /// Body: UpdateProfileRequest
    /// Roles: usuario, repartidor
    /// </summary>
    [HttpPatch("me")]
    [Authorize(Roles = "usuario,repartidor,admin")]
    public async Task<ActionResult<UserProfileResponse>> UpdateMyProfile([FromBody] UpdateProfileRequest request)
    {
        // TODO: Extraer userId del JWT
        var userId = User.FindFirst("sub")?.Value ?? throw new UnauthorizedAccessException("No subject claim in token");
        if (!Guid.TryParse(userId, out var userIdGuid))
            return Unauthorized(new ErrorResponse("INVALID_TOKEN", "Invalid userId in token"));

        _logger.LogInformation("PATCH /me - Updating profile for userId: {UserId}", userIdGuid);

        var profile = await _profileService.UpdateMyProfileAsync(userIdGuid, request);
        if (profile == null)
            return NotFound(new ErrorResponse("NOT_FOUND", "Profile not found"));

        return Ok(profile);
    }

    /// <summary>
    /// 4) Cambiar disponibilidad (repartidor).
    /// POST /api/profiles/me/availability
    /// Body: AvailabilityRequest { disponible: bool }
    /// Roles: repartidor
    /// Efecto: Publica evento repartidor.availability.changed
    /// </summary>
    [HttpPost("me/availability")]
    [Authorize(Roles = "repartidor")]
    public async Task<ActionResult<AvailabilityResponse>> SetAvailability([FromBody] AvailabilityRequest request)
    {
        // TODO: Extraer userId del JWT y validar rol repartidor
        var userId = User.FindFirst("sub")?.Value ?? throw new UnauthorizedAccessException("No subject claim in token");
        if (!Guid.TryParse(userId, out var userIdGuid))
            return Unauthorized(new ErrorResponse("INVALID_TOKEN", "Invalid userId in token"));

        _logger.LogInformation("POST /me/availability - Setting disponible={Disponible} for userId: {UserId}",
            request.Disponible, userIdGuid);

        try
        {
            var response = await _profileService.SetAvailabilityAsync(userIdGuid, request.Disponible);
            if (response == null)
                return NotFound(new ErrorResponse("NOT_FOUND", "Profile not found"));

            // TODO: Publicar evento RabbitMQ: repartidor.availability.changed

            return Ok(response);
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Invalid operation setting availability");
            return BadRequest(new ErrorResponse("INVALID_OPERATION", ex.Message));
        }
    }

    /// <summary>
    /// 5) Obtener disponibilidad (opcional).
    /// GET /api/profiles/me/availability
    /// Roles: repartidor
    /// </summary>
    [HttpGet("me/availability")]
    [Authorize(Roles = "repartidor")]
    public async Task<ActionResult<AvailabilityResponse>> GetMyAvailability()
    {
        // TODO: Extraer userId del JWT
        var userId = User.FindFirst("sub")?.Value ?? throw new UnauthorizedAccessException("No subject claim in token");
        if (!Guid.TryParse(userId, out var userIdGuid))
            return Unauthorized(new ErrorResponse("INVALID_TOKEN", "Invalid userId in token"));

        _logger.LogInformation("GET /me/availability - userId: {UserId}", userIdGuid);

        var response = await _profileService.GetMyAvailabilityAsync(userIdGuid);
        if (response == null)
            return NotFound(new ErrorResponse("NOT_FOUND", "Profile not found"));

        return Ok(response);
    }

    // ===== Endpoints Admin =====

    /// <summary>
    /// 6) Listar perfiles (admin).
    /// GET /api/profiles?tipo=&isActive=&limit=&offset=
    /// Roles: admin
    /// </summary>
    [HttpGet]
    [Authorize(Roles = "admin")]
    public async Task<ActionResult<PaginatedResponse<UserProfileResponse>>> ListProfiles(
        [FromQuery] string? tipo = null,
        [FromQuery] bool? isActive = null,
        [FromQuery] int offset = 0,
        [FromQuery] int limit = 10)
    {
        // TODO: Validar rol admin

        _logger.LogInformation("GET / - Listing profiles: tipo={Tipo}, isActive={IsActive}, offset={Offset}, limit={Limit}",
            tipo, isActive, offset, limit);

        var response = await _profileService.ListProfilesAsync(tipo, isActive, offset, limit);
        return Ok(response);
    }

    /// <summary>
    /// 7) Obtener perfil por ID (admin o propietario).
    /// GET /api/profiles/{profileId}
    /// Roles: admin, owner (si userId coincide)
    /// </summary>
    [HttpGet("{profileId:guid}")]
    [Authorize(Roles = "admin")]
    public async Task<ActionResult<UserProfileResponse>> GetProfileById(Guid profileId)
    {
        // TODO: Validar autorización (admin o propietario)

        _logger.LogInformation("GET /{ProfileId} - Retrieving profile", profileId);

        var profile = await _profileService.GetProfileByIdAsync(profileId);
        if (profile == null)
            return NotFound(new ErrorResponse("NOT_FOUND", "Profile not found"));

        return Ok(profile);
    }

    /// <summary>
    /// 8) Actualizar perfil por ID (admin).
    /// PATCH /api/profiles/{profileId}
    /// Body: UpdateProfileRequest
    /// Roles: admin
    /// </summary>
    [HttpPatch("{profileId:guid}")]
    [Authorize(Roles = "admin")]
    public async Task<ActionResult<UserProfileResponse>> UpdateProfileById(
        Guid profileId,
        [FromBody] UpdateProfileRequest request)
    {
        // TODO: Validar rol admin

        _logger.LogInformation("PATCH /{ProfileId} - Updating profile (admin)", profileId);

        var profile = await _profileService.UpdateProfileByIdAsync(profileId, request);
        if (profile == null)
            return NotFound(new ErrorResponse("NOT_FOUND", "Profile not found"));

        return Ok(profile);
    }

    /// <summary>
    /// 9) Desactivar perfil (admin).
    /// POST /api/profiles/{profileId}/deactivate
    /// Roles: admin
    /// </summary>
    [HttpPost("{profileId:guid}/deactivate")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> DeactivateProfile(Guid profileId)
    {
        // TODO: Validar rol admin

        _logger.LogInformation("POST /{ProfileId}/deactivate - Deactivating profile", profileId);

        var success = await _profileService.DeactivateProfileAsync(profileId);
        if (!success)
            return NotFound(new ErrorResponse("NOT_FOUND", "Profile not found"));

        // TODO: Publicar evento RabbitMQ: profile.deactivated

        return Ok(new { status = "deactivated" });
    }

    /// <summary>
    /// 10) Activar perfil (admin).
    /// POST /api/profiles/{profileId}/activate
    /// Roles: admin
    /// </summary>
    [HttpPost("{profileId:guid}/activate")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> ActivateProfile(Guid profileId)
    {
        // TODO: Validar rol admin

        _logger.LogInformation("POST /{ProfileId}/activate - Activating profile", profileId);

        var success = await _profileService.ActivateProfileAsync(profileId);
        if (!success)
            return NotFound(new ErrorResponse("NOT_FOUND", "Profile not found"));

        return Ok(new { status = "activated" });
    }

    /// <summary>
    /// 11) Eliminar perfil (admin).
    /// DELETE /api/profiles/{profileId}
    /// Roles: admin
    /// </summary>
    [HttpDelete("{profileId:guid}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> DeleteProfile(Guid profileId)
    {
        // TODO: Validar rol admin

        _logger.LogInformation("DELETE /{ProfileId} - Deleting profile", profileId);

        var success = await _profileService.DeleteProfileAsync(profileId);
        if (!success)
            return NotFound(new ErrorResponse("NOT_FOUND", "Profile not found"));

        return NoContent();
    }

    // ===== Endpoints Internal (Gateway-only) =====

    /// <summary>
    /// 12) Listar repartidores disponibles (internal).
    /// GET /api/profiles/delivery?limit=&offset=&onlyAvailable=true
    /// Roles: internal (API Gateway only)
    /// Header: X-Client: gateway
    /// </summary>
    [HttpGet("delivery")]
    [Authorize(Roles = "usuario,repartidor,admin")]
    public async Task<ActionResult<PaginatedResponse<UserProfileResponse>>> ListAvailableDelivery(
        [FromQuery] bool onlyAvailable = true,
        [FromQuery] int offset = 0,
        [FromQuery] int limit = 10)
    {
        // Validar que sea llamada interna (gateway)
        if (!ValidateInternalCall())
            return Forbid();

        _logger.LogInformation("GET /delivery - Listing available delivery profiles: onlyAvailable={OnlyAvailable}, offset={Offset}, limit={Limit}",
            onlyAvailable, offset, limit);

        var response = await _profileService.ListAvailableDeliveryAsync(onlyAvailable, offset, limit);
        return Ok(response);
    }

    /// <summary>
    /// 13) Búsqueda avanzada (internal).
    /// GET /api/profiles/search?tipo=&disponible=&limit=&offset=
    /// Roles: internal (API Gateway only)
    /// Header: X-Client: gateway
    /// </summary>
    [HttpGet("search")]
    [Authorize(Roles = "usuario,repartidor,admin")]
    public async Task<ActionResult<PaginatedResponse<UserProfileResponse>>> SearchProfiles(
        [FromQuery] string? tipo = null,
        [FromQuery] bool? disponible = null,
        [FromQuery] int offset = 0,
        [FromQuery] int limit = 10)
    {
        // Validar que sea llamada interna (gateway)
        if (!ValidateInternalCall())
            return Forbid();

        _logger.LogInformation("GET /search - Searching profiles: tipo={Tipo}, disponible={Disponible}, offset={Offset}, limit={Limit}",
            tipo, disponible, offset, limit);

        var response = await _profileService.SearchProfilesAsync(tipo, disponible, offset, limit);
        return Ok(response);
    }

    /// <summary>
    /// 14) Reserva atómica (internal).
    /// POST /api/profiles/{profileId}/reserve
    /// Body: ReserveRequest { ttlSeconds?: number }
    /// Roles: internal (API Gateway / order-service)
    /// Respuestas: 200 OK si éxito, 409 Conflict si ya reservado/indisponible
    /// </summary>
    [HttpPost("{profileId:guid}/reserve")]
    [Authorize(Roles = "usuario,repartidor,admin")]
    public async Task<ActionResult<ReserveResponse>> ReserveProfile(
        Guid profileId,
        [FromBody] ReserveRequest? request = null)
    {
        // Validar que sea llamada interna (gateway)
        if (!ValidateInternalCall())
            return Forbid();

        var ttlSeconds = request?.TtlSeconds ?? 300;

        _logger.LogInformation("POST /{ProfileId}/reserve - Attempting atomic reserve, ttl={TtlSeconds}", profileId, ttlSeconds);

        var response = await _profileService.ReserveProfileAtomicAsync(profileId, ttlSeconds);
        if (response == null)
        {
            _logger.LogWarning("Reserve failed - profile already reserved or unavailable: {ProfileId}", profileId);
            return Conflict(new ErrorResponse("CONFLICT", "Profile is not available or already reserved"));
        }

        // TODO: Publicar evento RabbitMQ: profile.reserved

        return Ok(response);
    }

    /// <summary>
    /// 15) Liberar reserva (internal).
    /// POST /api/profiles/{profileId}/release
    /// Roles: internal (API Gateway)
    /// </summary>
    [HttpPost("{profileId:guid}/release")]
    [Authorize(Roles = "usuario,repartidor,admin")]
    public async Task<IActionResult> ReleaseReservation(Guid profileId)
    {
        // Validar que sea llamada interna (gateway)
        if (!ValidateInternalCall())
            return Forbid();

        _logger.LogInformation("POST /{ProfileId}/release - Releasing reservation", profileId);

        var success = await _profileService.ReleaseReservationAsync(profileId);
        if (!success)
            return NotFound(new ErrorResponse("NOT_FOUND", "Profile not found"));

        // TODO: Publicar evento RabbitMQ: profile.released

        return Ok(new { status = "released" });
    }

    // ===== Helper methods =====

    /// <summary>
    /// Validar que la llamada sea desde el API Gateway.
    /// Por ahora valida el header X-Client: gateway.
    /// En producción, el Gateway validará JWT y roles automáticamente.
    /// </summary>
    private bool ValidateInternalCall()
    {
        var xClient = Request.Headers["X-Client"].ToString();
        if (xClient != "gateway")
        {
            _logger.LogWarning("Unauthorized internal call attempt - invalid X-Client header");
            return false;
        }
        return true;
    }
}
