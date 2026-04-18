export interface NotificationRecord {
  id: string;
  userId: string;
  tipo: string;
  mensaje: string;
  payload: unknown;
  leida: boolean;
  createdAt: string;
  readAt: string | null;
}

export interface CreateNotificationInput {
  userId: string;
  tipo: string;
  mensaje: string;
  payload?: unknown;
}

export interface ListNotificationsOptions {
  limit?: number;
  cursor?: string;
}

export interface ListNotificationsResult {
  notifications: NotificationRecord[];
  nextCursor: string | null;
}

const PRIMARY_PREFIX = "notif";
const ID_INDEX_PREFIX = "notif_id";
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

// Clave principal requerida por el diseno: notif:{userId}:{createdAt}
function buildPrimaryKey(userId: string, createdAtMs: number): string {
  return `${PRIMARY_PREFIX}:${userId}:${createdAtMs}`;
}

// Indice secundario manual para resolver PATCH /notificaciones/:id/leer.
function buildIdIndexKey(id: string): string {
  return `${ID_INDEX_PREFIX}:${id}`;
}

function clampListLimit(limit?: number): number {
  if (!limit || Number.isNaN(limit)) {
    return DEFAULT_LIST_LIMIT;
  }

  return Math.min(Math.max(limit, 1), MAX_LIST_LIMIT);
}

function parseNotification(raw: string | null): NotificationRecord | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<NotificationRecord>;
    if (
      typeof parsed.id !== "string" ||
      typeof parsed.userId !== "string" ||
      typeof parsed.tipo !== "string" ||
      typeof parsed.mensaje !== "string" ||
      typeof parsed.leida !== "boolean" ||
      typeof parsed.createdAt !== "string"
    ) {
      return null;
    }

    return {
      id: parsed.id,
      userId: parsed.userId,
      tipo: parsed.tipo,
      mensaje: parsed.mensaje,
      payload: parsed.payload ?? null,
      leida: parsed.leida,
      createdAt: parsed.createdAt,
      readAt: typeof parsed.readAt === "string" ? parsed.readAt : null,
    };
  } catch {
    // Evita romper el flujo si un registro KV esta corrupto.
    return null;
  }
}

async function reservePrimaryKey(
  kv: KVNamespace,
  userId: string,
): Promise<{ key: string; createdAtMs: number }> {
  let createdAtMs = Date.now();

  // Evita colisiones cuando llegan multiples notificaciones del mismo usuario
  // en el mismo milisegundo y mantiene el formato requerido notif:{userId}:{createdAt}.
  while (true) {
    const key = buildPrimaryKey(userId, createdAtMs);
    const existing = await kv.get(key);
    if (existing === null) {
      return { key, createdAtMs };
    }
    createdAtMs += 1;
  }
}

export async function createNotification(
  env: Env,
  input: CreateNotificationInput,
): Promise<NotificationRecord> {
  const { key, createdAtMs } = await reservePrimaryKey(env.NOTIFICATIONS, input.userId);
  const notification: NotificationRecord = {
    id: crypto.randomUUID(),
    userId: input.userId,
    tipo: input.tipo,
    mensaje: input.mensaje,
    payload: input.payload ?? null,
    leida: false,
    createdAt: new Date(createdAtMs).toISOString(),
    readAt: null,
  };

  await env.NOTIFICATIONS.put(key, JSON.stringify(notification));
  // Guarda el puntero id -> key principal para busqueda O(1) por id.
  await env.NOTIFICATIONS.put(buildIdIndexKey(notification.id), key);

  return notification;
}

export async function listNotificationsByUser(
  env: Env,
  userId: string,
  options: ListNotificationsOptions = {},
): Promise<ListNotificationsResult> {
  // KV permite listar por prefijo, por eso agrupamos por userId en la key.
  const page = await env.NOTIFICATIONS.list({
    prefix: `${PRIMARY_PREFIX}:${userId}:`,
    limit: clampListLimit(options.limit),
    cursor: options.cursor,
  });

  const rawValues = await Promise.all(page.keys.map((entry) => env.NOTIFICATIONS.get(entry.name)));

  const notifications = rawValues
    .map(parseNotification)
    .filter((item): item is NotificationRecord => item !== null)
    // Orden descendente por fecha para mostrar primero lo mas reciente.
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    notifications,
    nextCursor: page.list_complete ? null : page.cursor,
  };
}

export async function markNotificationAsRead(
  env: Env,
  id: string,
): Promise<NotificationRecord | null> {
  // 1) Busca la key real a partir del id.
  const primaryKey = await env.NOTIFICATIONS.get(buildIdIndexKey(id));
  if (!primaryKey) {
    return null;
  }

  // 2) Lee y actualiza el documento principal.
  const rawNotification = await env.NOTIFICATIONS.get(primaryKey);
  const notification = parseNotification(rawNotification);
  if (!notification) {
    // Si el registro principal se perdio, se comporta como "no encontrado".
    return null;
  }

  if (notification.leida) {
    // Idempotencia: si ya estaba leida, responde el mismo estado sin reescribir.
    return notification;
  }

  const updated: NotificationRecord = {
    ...notification,
    leida: true,
    readAt: new Date().toISOString(),
  };

  await env.NOTIFICATIONS.put(primaryKey, JSON.stringify(updated));

  return updated;
}
