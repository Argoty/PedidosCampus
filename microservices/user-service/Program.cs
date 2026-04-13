using PedidosCampus.UserService.Data;
using PedidosCampus.UserService.Services;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// ===== Servicios de configuración =====

// Entity Framework Core + PostgreSQL
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") 
    ?? builder.Configuration["USUARIOS_DATABASE_URL"]
    ?? "Host=localhost;Port=5432;Database=user_db;Username=user_user;Password=user_password";

builder.Services.AddDbContext<UserServiceDbContext>(options =>
    options.UseNpgsql(connectionString)
);

// Servicios de negocio
builder.Services.AddScoped<IProfileService, ProfileService>();

// Controllers y OpenAPI
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new Microsoft.OpenApi.Models.OpenApiInfo
    {
        Title = "User Service API",
        Version = "v1",
        Description = "Microservicio de perfiles de usuario y repartidor para PedidosCampus",
        Contact = new Microsoft.OpenApi.Models.OpenApiContact
        {
            Name = "PedidosCampus Team",
            Email = "equipo@pedidoscampus.local"
        }
    });
});

// CORS (preparar para Gateway)
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowGateway", builder =>
    {
        builder
            .WithOrigins("http://localhost:3000", "http://localhost:3001") // Gateway y frontend
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

// ===== Pipeline de la aplicación =====

var app = builder.Build();

// Aplicar CORS
app.UseCors("AllowGateway");

// Swagger en desarrollo
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/swagger/v1/swagger.json", "User Service v1");
    });
}

app.UseHttpsRedirection();
app.MapControllers();

// Aplica migraciones pendientes al iniciar (desarrollo)
if (app.Environment.IsDevelopment())
{
    using (var scope = app.Services.CreateScope())
    {
        var dbContext = scope.ServiceProvider.GetRequiredService<UserServiceDbContext>();
        dbContext.Database.Migrate();
    }
}

app.Run();

