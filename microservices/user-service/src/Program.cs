using PedidosCampus.UserService.Data;
using PedidosCampus.UserService.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi.Models;
using System.Text;
using System.Security.Claims;

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

// Decode JWT claims without signature verification
app.Use(async (context, next) => {
    if (context.Request.Method == "OPTIONS")
    {
        await next();
        return;
    }

    var authHeader = context.Request.Headers["Authorization"].ToString();
    if (!string.IsNullOrWhiteSpace(authHeader) && authHeader.StartsWith("Bearer "))
    {
        var token = authHeader.Substring("Bearer ".Length).Trim();
        var parts = token.Split('.');
        if (parts.Length == 3)
        {
            try
            {
                var payload = parts[1]
                    .Replace('-', '+')
                    .Replace('_', '/');

                switch (payload.Length % 4)
                {
                    case 2: payload += "=="; break;
                    case 3: payload += "="; break;
                }

                var jsonBytes = Convert.FromBase64String(payload);
                var json = Encoding.UTF8.GetString(jsonBytes);
                var claims = new List<Claim>();

                var doc = System.Text.Json.JsonDocument.Parse(json);
                foreach (var prop in doc.RootElement.EnumerateObject())
                {
                    if (prop.Value.ValueKind == System.Text.Json.JsonValueKind.String)
                    {
                        claims.Add(new Claim(prop.Name, prop.Value.GetString() ?? string.Empty));
                    }
                }

                var identity = new ClaimsIdentity(claims, "Bearer");
                context.User = new ClaimsPrincipal(identity);
            }
            catch
            {
                // Ignore invalid token; authorization will fail
            }
        }
    }

    await next();
});

app.Use(async (context, next) => {
    var expectedToken = builder.Configuration["SERVICE_TOKEN"];
    if (context.Request.Method != "OPTIONS" && (!context.Request.Headers.TryGetValue("x-service-token", out var token) || token != expectedToken)) {
        context.Response.StatusCode = 403;
        await context.Response.WriteAsJsonAsync(new { error = "Forbidden" });
        return;
    }
    await next();
});

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
