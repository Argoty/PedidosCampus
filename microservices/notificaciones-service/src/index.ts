import { routeNotificationEndpoints } from "./handlers/notificaciones";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
};

// CORS minimo para poder probar desde navegador/Postman sin bloqueo.
function withCorsHeaders(response: Response): Response {
  return response;
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

// Extraer userId del JWT sin verificacion (confiamos en que el Gateway lo verifico)
function extractUserIdFromJwt(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.substring(7);
  try {
    // JWT: header.payload.signature
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const payload = JSON.parse(atob(parts[1]));
    return payload.sub || null; // El campo 'sub' contiene el userId
  } catch {
    return null;
  }
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

      const envServiceToken = env.SERVICE_TOKEN;
      if (request.headers.get("x-service-token") !== envServiceToken) {
        return withCorsHeaders(jsonResponse({ error: "Forbidden" }, 403));
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

      // Extraer userId del JWT. Solo GET/PATCH usan userId.
      // POST /notifications es Order Service (no requiere JWT).
      const userId = extractUserIdFromJwt(request.headers.get("authorization"));
      const needsAuth = (pathname === "/notifications" && request.method === "GET") ||
        pathname.match(/^\/notifications\/[^/]+\/leer$/);

      if (needsAuth && !userId) {
        return withCorsHeaders(
          jsonResponse({ error: "Unauthorized - Missing or invalid JWT" }, 401)
        );
      }

      const notifRoute = await routeNotificationEndpoints(request, env, pathname, userId || "");
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
