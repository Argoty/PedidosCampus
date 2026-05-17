import {
  createNotification,
  listNotificationsByUser,
  markNotificationAsRead,
} from "../services/kv";

interface ApiError {
  error: string;
}

interface CreateNotificationBody {
  userId?: unknown;
  tipo?: unknown;
  mensaje?: unknown;
  payload?: unknown;
}

interface RouteMatch {
  handled: boolean;
  response?: Response;
}

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}

function errorResponse(message: string, status = 400): Response {
  const payload: ApiError = { error: message };
  return jsonResponse(payload, status);
}

function methodNotAllowedResponse(): Response {
  return errorResponse("Metodo no permitido.", 405);
}

async function parseJsonBody(request: Request): Promise<CreateNotificationBody | null> {
  try {
    return (await request.json()) as CreateNotificationBody;
  } catch {
    // Respuesta null permite devolver error 400 uniforme desde el handler.
    return null;
  }
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isInvalidUserId(value: string): boolean {
  return value.toLowerCase().startsWith("bearer ");
}

// Sanitiza query param para paginacion sin aceptar valores invalidos.
function parseLimit(value: string | null): number | undefined {
  if (value === null) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return undefined;
  }

  return parsed;
}

async function handleCreate(request: Request, env: Env): Promise<Response> {
  const body = await parseJsonBody(request);
  if (!body) {
    return errorResponse("Body JSON invalido.");
  }

  const userId = asNonEmptyString(body.userId);
  const tipo = asNonEmptyString(body.tipo);
  const mensaje = asNonEmptyString(body.mensaje);

  if (!userId || !tipo || !mensaje) {
    // Validacion minima de contrato para evitar escribir registros incompletos en KV.
    return errorResponse("Campos requeridos: userId, tipo, mensaje.");
  }

  if (isInvalidUserId(userId)) {
    return errorResponse("userId invalido.");
  }

  // Hoy este endpoint simula la llegada de un evento asincrono.
  // Futuro: un consumer real de RabbitMQ/Kafka llamara esta misma capa de persistencia
  // o insertara directamente desde un trigger interno del microservicio.
  const notification = await createNotification(env, {
    userId,
    tipo,
    mensaje,
    payload: body.payload,
  });

  return jsonResponse(notification, 201);
}

async function handleListByUser(
  request: Request,
  env: Env,
  authenticatedUserId: string
): Promise<Response> {
  const url = new URL(request.url);
  const limit = parseLimit(url.searchParams.get("limit"));
  const cursor = url.searchParams.get("cursor") ?? undefined;

  const result = await listNotificationsByUser(env, authenticatedUserId, { limit, cursor });
  return jsonResponse(result);
}

async function handleMarkAsRead(
  env: Env,
  notificationId: string,
  authenticatedUserId: string
): Promise<Response> {
  const id = asNonEmptyString(notificationId);
  if (!id) {
    return errorResponse("id invalido.");
  }

  // Obtener notificación para validar propiedad
  const notification = await (async () => {
    const raw = await env.NOTIFICATIONS.get(`notif_id:${id}`);
    if (!raw) return null;

    const primaryKey = raw;
    const notifData = await env.NOTIFICATIONS.get(primaryKey);
    if (!notifData) return null;

    try {
      return JSON.parse(notifData);
    } catch {
      return null;
    }
  })();

  if (!notification) {
    return errorResponse("Notificacion no encontrada.", 404);
  }

  // Validar propiedad
  if (notification.userId !== authenticatedUserId) {
    return errorResponse("Forbidden - No tienes permisos", 403);
  }

  const updated = await markNotificationAsRead(env, id);
  if (!updated) {
    return errorResponse("Notificacion no encontrada.", 404);
  }

  return jsonResponse(updated);
}

export async function routeNotificationEndpoints(
  request: Request,
  env: Env,
  pathname: string,
  authenticatedUserId: string
): Promise<RouteMatch> {
  // Router HTTP minimalista sin frameworks (requisito del proyecto).
  if (pathname === "/notifications") {
    if (request.method === "POST") {
      return {
        handled: true,
        response: await handleCreate(request, env),
      };
    }

    if (request.method === "GET") {
      return {
        handled: true,
        response: await handleListByUser(
          request,
          env,
          authenticatedUserId
        ),
      };
    }

    return {
      handled: true,
      response: methodNotAllowedResponse(),
    };
  }

  const markReadMatch = pathname.match(/^\/notifications\/([^/]+)\/leer$/);
  if (markReadMatch) {
    if (request.method === "PATCH") {
      return {
        handled: true,
        response: await handleMarkAsRead(
          env,
          decodeURIComponent(markReadMatch[1]),
          authenticatedUserId
        ),
      };
    }

    return {
      handled: true,
      response: methodNotAllowedResponse(),
    };
  }

  return { handled: false };
}
