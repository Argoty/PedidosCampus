import { routeNotificationEndpoints } from "./handlers/notificaciones";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
};

// CORS minimo para poder probar desde navegador/Postman sin bloqueo.
function withCorsHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", "*");
  headers.set("access-control-allow-methods", "GET,POST,PATCH,OPTIONS");
  headers.set("access-control-allow-headers", "content-type");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  // Respuesta JSON estandar para mantener consistencia entre endpoints.
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}

function notFoundResponse(): Response {
  return jsonResponse({ error: "Ruta no encontrada." }, 404);
}

function methodNotAllowedResponse(): Response {
  return jsonResponse({ error: "Metodo no permitido." }, 405);
}

export default {
  // Punto de entrada serverless: Cloudflare ejecuta esto por cada request.
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    try {
      const url = new URL(request.url);
      const pathname = url.pathname;

      if (request.method === "OPTIONS") {
        return withCorsHeaders(new Response(null, { status: 204 }));
      }

      if (pathname === "/health" && request.method === "GET") {
        // Health simple para smoke test local y post-deploy.
        return withCorsHeaders(
          jsonResponse({
            status: "ok",
            service: "notificaciones-service",
            runtime: "cloudflare-workers",
            storage: "cloudflare-kv",
            now: new Date().toISOString(),
          }),
        );
      }

      if (pathname === "/health") {
        return withCorsHeaders(methodNotAllowedResponse());
      }

      // Delega endpoints de negocio a handlers especializados.
      const notifRoute = await routeNotificationEndpoints(request, env, pathname);
      if (notifRoute.handled && notifRoute.response) {
        return withCorsHeaders(notifRoute.response);
      }

      return withCorsHeaders(notFoundResponse());
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error interno.";
      return withCorsHeaders(jsonResponse({ error: message }, 500));
    }
  },
};
