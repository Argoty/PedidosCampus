using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;
using System.Security.Claims;
using System.Text.Encodings.Web;

namespace PedidosCampus.UserService;

/// <summary>
/// Custom authentication handler that trusts the manual JWT middleware.
/// The middleware (Program.cs lines 97-147) already decodes the JWT and sets context.User.
/// This handler simply accepts the already-authenticated user without additional validation.
/// </summary>
public class ManualJwtAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    public ManualJwtAuthHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder)
        : base(options, logger, encoder)
    {
    }

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        // The manual middleware in Program.cs already decoded the JWT
        // and set context.User with all claims including "role"
        // We just need to create the AuthenticationTicket from the existing context.User
        
        if (Context.User?.Identity?.IsAuthenticated == true)
        {
            var ticket = new AuthenticationTicket(Context.User, "ManualJwt");
            return Task.FromResult(AuthenticateResult.Success(ticket));
        }

        // No authenticated user - let authorization handle the denial
        return Task.FromResult(AuthenticateResult.NoResult());
    }
}