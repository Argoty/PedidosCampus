using PedidosCampus.UserService.Data;
using PedidosCampus.UserService.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using System.Text;

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

// JWT Authentication (firma + expiracion)
var accessTokenSecret = builder.Configuration["ACCESS_TOKEN_SECRET"]
    ?? builder.Configuration["Jwt:AccessTokenSecret"];

if (string.IsNullOrWhiteSpace(accessTokenSecret))
{
    throw new InvalidOperationException("Missing JWT access token secret. Configure ACCESS_TOKEN_SECRET or Jwt:AccessTokenSecret.");
}

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false;

        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(accessTokenSecret)),
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30),
            RoleClaimType = "role",
            NameClaimType = "sub"
        };
    });

builder.Services.AddAuthorization();

// Controllers y OpenAPI
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "User Service API",
        Version = "v1",
        Description = "Microservicio de perfiles de usuario y repartidor para PedidosCampus",
        Contact = new OpenApiContact
        {
            Name = "PedidosCampus Team",
            Email = "equipo@pedidoscampus.local"
        }
    });

    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "JWT access token. Formato: Bearer {token}"
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
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
app.UseAuthentication();
app.UseAuthorization();
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
