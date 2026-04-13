using Xunit;
using Moq;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using PedidosCampus.UserService.Data;
using PedidosCampus.UserService.Models;
using PedidosCampus.UserService.Services;
using PedidosCampus.UserService.DTOs;

namespace PedidosCampus.UserService.Tests;

/// <summary>
/// Pruebas unitarias para ProfileService.
/// Usa InMemoryDatabase para evitar dependencia de PostgreSQL.
/// </summary>
public class ProfileServiceTests : IAsyncLifetime
{
    private UserServiceDbContext _context = null!;
    private ProfileService _profileService = null!;
    private Mock<ILogger<ProfileService>> _loggerMock = null!;

    public async Task InitializeAsync()
    {
        var options = new DbContextOptionsBuilder<UserServiceDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        _context = new UserServiceDbContext(options);
        _loggerMock = new Mock<ILogger<ProfileService>>();
        _profileService = new ProfileService(_context, _loggerMock.Object);

        await _context.Database.EnsureCreatedAsync();
    }

    public async Task DisposeAsync()
    {
        await _context.Database.EnsureDeletedAsync();
        await _context.DisposeAsync();
    }

    // ===== CREATE PROFILE Tests =====

    [Fact]
    public async Task CreateProfileAsync_WithValidData_ReturnsProfile()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var tipo = "usuario";
        var nombre = "John Doe";
        var telefono = "+57 300 1234567";
        var direccion = "Calle 1 #2-3";

        // Act
        var result = await _profileService.CreateProfileAsync(userId, tipo, nombre, telefono, direccion);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(tipo, result.Tipo);
        Assert.Equal(nombre, result.Nombre);
        Assert.Equal(telefono, result.Telefono);
        Assert.Equal(direccion, result.Direccion);
        Assert.False(result.Disponible);
        Assert.True(result.IsActive);
        Assert.Null(result.ReservedUntil);
    }

    [Fact]
    public async Task CreateProfileAsync_DuplicateUser_ThrowsException()
    {
        // Arrange
        var userId = Guid.NewGuid();

        await _profileService.CreateProfileAsync(userId, "usuario", "First", null, null);

        // Act & Assert
        await Assert.ThrowsAsync<InvalidOperationException>(async () =>
            await _profileService.CreateProfileAsync(userId, "usuario", "Second", null, null)
        );
    }

    [Fact]
    public async Task CreateProfileAsync_InvalidTipo_ThrowsException()
    {
        // Arrange
        var userId = Guid.NewGuid();

        // Act & Assert
        await Assert.ThrowsAsync<ArgumentException>(async () =>
            await _profileService.CreateProfileAsync(userId, "invalid", "Name", null, null)
        );
    }

    // ===== GET PROFILE Tests =====

    [Fact]
    public async Task GetMyProfileAsync_WithValidUserId_ReturnsProfile()
    {
        // Arrange
        var userId = Guid.NewGuid();
        await _profileService.CreateProfileAsync(userId, "repartidor", "Delivery User", null, null);

        // Act
        var result = await _profileService.GetMyProfileAsync(userId);

        // Assert
        Assert.NotNull(result);
        Assert.Equal("repartidor", result.Tipo);
        Assert.Equal("Delivery User", result.Nombre);
    }

    [Fact]
    public async Task GetMyProfileAsync_NonExistent_ReturnsNull()
    {
        // Act
        var result = await _profileService.GetMyProfileAsync(Guid.NewGuid());

        // Assert
        Assert.Null(result);
    }

    // ===== UPDATE PROFILE Tests =====

    [Fact]
    public async Task UpdateMyProfileAsync_WithValidData_UpdatesProfile()
    {
        // Arrange
        var userId = Guid.NewGuid();
        await _profileService.CreateProfileAsync(userId, "usuario", "Original Name", null, null);

        var updateRequest = new UpdateProfileRequest
        {
            Nombre = "Updated Name",
            Telefono = "+57 311 9876543",
            Direccion = "New Address"
        };

        // Act
        var result = await _profileService.UpdateMyProfileAsync(userId, updateRequest);

        // Assert
        Assert.NotNull(result);
        Assert.Equal("Updated Name", result.Nombre);
        Assert.Equal("+57 311 9876543", result.Telefono);
        Assert.Equal("New Address", result.Direccion);
    }

    // ===== AVAILABILITY Tests =====

    [Fact]
    public async Task SetAvailabilityAsync_ForRepartidor_UpdatesAvailability()
    {
        // Arrange
        var userId = Guid.NewGuid();
        await _profileService.CreateProfileAsync(userId, "repartidor", "Delivery", null, null);

        // Act
        var result = await _profileService.SetAvailabilityAsync(userId, true);

        // Assert
        Assert.NotNull(result);
        Assert.True(result.Disponible);
        Assert.Null(result.ReservedUntil);
    }

    [Fact]
    public async Task SetAvailabilityAsync_NonRepartidor_ThrowsException()
    {
        // Arrange
        var userId = Guid.NewGuid();
        await _profileService.CreateProfileAsync(userId, "usuario", "User", null, null);

        // Act & Assert
        await Assert.ThrowsAsync<InvalidOperationException>(async () =>
            await _profileService.SetAvailabilityAsync(userId, true)
        );
    }

    [Fact]
    public async Task GetMyAvailabilityAsync_ReturnsCurrentAvailability()
    {
        // Arrange
        var userId = Guid.NewGuid();
        await _profileService.CreateProfileAsync(userId, "repartidor", "Delivery", null, null);
        await _profileService.SetAvailabilityAsync(userId, true);

        // Act
        var result = await _profileService.GetMyAvailabilityAsync(userId);

        // Assert
        Assert.NotNull(result);
        Assert.True(result.Disponible);
    }

    // ===== LIST PROFILES Tests =====

    [Fact]
    public async Task ListProfilesAsync_WithNoFilter_ReturnsAllProfiles()
    {
        // Arrange
        await _profileService.CreateProfileAsync(Guid.NewGuid(), "usuario", "User 1", null, null);
        await _profileService.CreateProfileAsync(Guid.NewGuid(), "repartidor", "Delivery 1", null, null);
        await _profileService.CreateProfileAsync(Guid.NewGuid(), "usuario", "User 2", null, null);

        // Act
        var result = await _profileService.ListProfilesAsync();

        // Assert
        Assert.NotNull(result);
        Assert.Equal(3, result.Total);
        Assert.Equal(3, result.Items.Count);
    }

    [Fact]
    public async Task ListProfilesAsync_WithTipoFilter_ReturnsFilteredProfiles()
    {
        // Arrange
        await _profileService.CreateProfileAsync(Guid.NewGuid(), "usuario", "User 1", null, null);
        await _profileService.CreateProfileAsync(Guid.NewGuid(), "repartidor", "Delivery 1", null, null);
        await _profileService.CreateProfileAsync(Guid.NewGuid(), "usuario", "User 2", null, null);

        // Act
        var result = await _profileService.ListProfilesAsync(tipo: "usuario");

        // Assert
        Assert.NotNull(result);
        Assert.Equal(2, result.Total);
        Assert.Equal(2, result.Items.Count);
        Assert.All(result.Items, p => Assert.Equal("usuario", p.Tipo));
    }

    [Fact]
    public async Task ListProfilesAsync_Pagination_ReturnsCorrectItems()
    {
        // Arrange
        for (int i = 0; i < 25; i++)
        {
            await _profileService.CreateProfileAsync(Guid.NewGuid(), "usuario", $"User {i}", null, null);
        }

        // Act
        var page1 = await _profileService.ListProfilesAsync(offset: 0, limit: 10);
        var page2 = await _profileService.ListProfilesAsync(offset: 10, limit: 10);

        // Assert
        Assert.Equal(25, page1.Total);
        Assert.Equal(10, page1.Items.Count);
        Assert.Equal(10, page2.Items.Count);
    }

    // ===== ADMIN OPERATIONS Tests =====

    [Fact]
    public async Task DeactivateProfileAsync_MarksProfileInactive()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var profile = await _profileService.CreateProfileAsync(userId, "usuario", "User", null, null);

        // Act
        var success = await _profileService.DeactivateProfileAsync(profile.Id);
        var updated = await _profileService.GetProfileByIdAsync(profile.Id);

        // Assert
        Assert.True(success);
        // Inactive profile shouldn't be returned from GetMyProfile
        var myProfile = await _profileService.GetMyProfileAsync(userId);
        Assert.Null(myProfile);
    }

    [Fact]
    public async Task ActivateProfileAsync_MarksProfileActive()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var profile = await _profileService.CreateProfileAsync(userId, "usuario", "User", null, null);
        await _profileService.DeactivateProfileAsync(profile.Id);

        // Act
        var success = await _profileService.ActivateProfileAsync(profile.Id);

        // Assert
        Assert.True(success);
        var myProfile = await _profileService.GetMyProfileAsync(userId);
        Assert.NotNull(myProfile);
        Assert.True(myProfile.IsActive);
    }

    // ===== DELIVERY / RESERVATION Tests =====

    [Fact]
    public async Task ListAvailableDeliveryAsync_ReturnsOnlyAvailableRepartidores()
    {
        // Arrange
        var userId1 = Guid.NewGuid();
        var userId2 = Guid.NewGuid();
        var userId3 = Guid.NewGuid();
        
        var delivery1 = await _profileService.CreateProfileAsync(userId1, "repartidor", "Delivery 1", null, null);
        var delivery2 = await _profileService.CreateProfileAsync(userId2, "repartidor", "Delivery 2", null, null);
        var user = await _profileService.CreateProfileAsync(userId3, "usuario", "User", null, null);

        // Make delivery1 available
        await _profileService.SetAvailabilityAsync(userId1, true);

        // Act
        var result = await _profileService.ListAvailableDeliveryAsync(onlyAvailable: true);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(1, result.Items.Count);
        Assert.Equal(delivery1.Id, result.Items[0].Id);
    }

    [Fact]
    public async Task ReserveProfileAtomicAsync_Success_ReturnsReserveResponse()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var profile = await _profileService.CreateProfileAsync(userId, "repartidor", "Delivery", null, null);
        await _profileService.SetAvailabilityAsync(userId, true);

        // Act
        var result = await _profileService.ReserveProfileAtomicAsync(profile.Id, ttlSeconds: 300);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(profile.Id, result.ProfileId);
        Assert.NotNull(result.ReservedUntil);
        Assert.Equal("reserved", result.Status);
        // Verify reserved time is approximately 5 minutes from now
        var timeDiff = (result.ReservedUntil - DateTime.UtcNow).TotalSeconds;
        Assert.InRange(timeDiff, 295, 305);
    }

    [Fact]
    public async Task ReserveProfileAtomicAsync_NotAvailable_ReturnsNull()
    {
        // Arrange
        var profile = await _profileService.CreateProfileAsync(Guid.NewGuid(), "repartidor", "Delivery", null, null);
        // Profile is NOT set as available

        // Act
        var result = await _profileService.ReserveProfileAtomicAsync(profile.Id);

        // Assert
        Assert.Null(result);
    }

    [Fact]
    public async Task ReserveProfileAtomicAsync_AlreadyReserved_ReturnsNull()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var profile = await _profileService.CreateProfileAsync(userId, "repartidor", "Delivery", null, null);
        await _profileService.SetAvailabilityAsync(userId, true);
        await _profileService.ReserveProfileAtomicAsync(profile.Id, ttlSeconds: 60);

        // Act - Try to reserve again
        var result = await _profileService.ReserveProfileAtomicAsync(profile.Id);

        // Assert
        Assert.Null(result);
    }

    [Fact]
    public async Task ReleaseReservationAsync_ClearsReservation()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var profile = await _profileService.CreateProfileAsync(userId, "repartidor", "Delivery", null, null);
        await _profileService.SetAvailabilityAsync(userId, true);
        await _profileService.ReserveProfileAtomicAsync(profile.Id);

        // Act
        var success = await _profileService.ReleaseReservationAsync(profile.Id);
        var updated = await _profileService.GetProfileByIdAsync(profile.Id);

        // Assert
        Assert.True(success);
        Assert.NotNull(updated);
        Assert.Null(updated.ReservedUntil);
    }

    // ===== SEARCH Tests =====

    [Fact]
    public async Task SearchProfilesAsync_ByTipo_ReturnsFilteredProfiles()
    {
        // Arrange
        await _profileService.CreateProfileAsync(Guid.NewGuid(), "usuario", "User", null, null);
        await _profileService.CreateProfileAsync(Guid.NewGuid(), "repartidor", "Delivery", null, null);

        // Act
        var result = await _profileService.SearchProfilesAsync(tipo: "repartidor");

        // Assert
        Assert.Single(result.Items);
        Assert.Equal("repartidor", result.Items[0].Tipo);
    }

    [Fact]
    public async Task SearchProfilesAsync_ByDisponible_ReturnsFilteredProfiles()
    {
        // Arrange
        var userId1 = Guid.NewGuid();
        var userId2 = Guid.NewGuid();
        
        var user1 = await _profileService.CreateProfileAsync(userId1, "repartidor", "Delivery 1", null, null);
        var user2 = await _profileService.CreateProfileAsync(userId2, "repartidor", "Delivery 2", null, null);
        
        await _profileService.SetAvailabilityAsync(userId1, true);
        // user2 remains unavailable

        // Act
        var result = await _profileService.SearchProfilesAsync(disponible: true);

        // Assert
        Assert.Single(result.Items);
        Assert.True(result.Items[0].Disponible);
    }
}
