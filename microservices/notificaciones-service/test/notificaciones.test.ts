import { describe, expect, it } from "vitest";
import worker from "../src/index";

// Mock liviano de KV para pruebas unitarias sin Cloudflare real.
class InMemoryKV {
  private readonly store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async put(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async list(options: { prefix?: string; limit?: number; cursor?: string }) {
    const prefix = options.prefix ?? "";
    const limit = options.limit ?? 1000;
    const all = [...this.store.keys()].filter((key) => key.startsWith(prefix)).sort();

    const start = options.cursor ? Number.parseInt(options.cursor, 10) : 0;
    const slice = all.slice(start, start + limit);
    const nextIndex = start + slice.length;

    return {
      keys: slice.map((name) => ({ name })),
      list_complete: nextIndex >= all.length,
      cursor: String(nextIndex),
    };
  }
}

function createEnv(): Env {
  // Simula los bindings que Wrangler entrega en runtime.
  return {
    NOTIFICATIONS: new InMemoryKV() as unknown as KVNamespace,
    SERVICE_TOKEN: "test-service-token",
  };
}

const authHeaders = {
  "content-type": "application/json",
  "x-service-token": "test-service-token",
};

// JWT para test: sub=user-a
const jwtUserA = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLWEifQ.sig";
const jwtReaderOne = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJyZWFkZXItMSJ9.sig";

describe("notificaciones worker", () => {
  it("crea una notificacion", async () => {
    const env = createEnv();
    const request = new Request("http://localhost/notifications", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        userId: "u-123",
        tipo: "PEDIDO_ESTADO_CAMBIADO",
        mensaje: "Tu pedido esta en camino",
        payload: { pedidoId: "p-1", estado: "en_camino" },
      }),
    });

    const response = await worker.fetch(request, env, {} as ExecutionContext);
    const body = (await response.json()) as {
      id: string;
      userId: string;
      tipo: string;
      mensaje: string;
      leida: boolean;
      readAt: string | null;
    };

    expect(response.status).toBe(201);
    expect(body.id).toBeTruthy();
    expect(body.userId).toBe("u-123");
    expect(body.tipo).toBe("PEDIDO_ESTADO_CAMBIADO");
    expect(body.mensaje).toBe("Tu pedido esta en camino");
    expect(body.leida).toBe(false);
    expect(body.readAt).toBeNull();
  });

  it("lista notificaciones por usuario", async () => {
    const env = createEnv();

    const createForUserA = async (mensaje: string) => {
      await worker.fetch(
        new Request("http://localhost/notifications", {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            userId: "user-a",
            tipo: "TEST",
            mensaje,
          }),
        }),
        env,
        {} as ExecutionContext,
      );
    };

    await createForUserA("primera");
    await createForUserA("segunda");

    await worker.fetch(
      new Request("http://localhost/notifications", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          userId: "user-b",
          tipo: "TEST",
          mensaje: "otra",
        }),
      }),
      env,
      {} as ExecutionContext,
    );

    // GET /notifications con JWT de user-a
    const response = await worker.fetch(
      new Request("http://localhost/notifications", {
        headers: {
          "x-service-token": "test-service-token",
          "authorization": `Bearer ${jwtUserA}`,
        },
      }),
      env,
      {} as ExecutionContext,
    );

    const body = (await response.json()) as {
      notifications: Array<{ userId: string; mensaje: string }>;
      nextCursor: string | null;
    };

    expect(response.status).toBe(200);
    expect(body.notifications).toHaveLength(2);
    expect(body.notifications.every((item) => item.userId === "user-a")).toBe(true);
    expect(body.notifications.map((item) => item.mensaje)).toEqual(["segunda", "primera"]);
    expect(body.nextCursor).toBeNull();
  });

  it("marca notificacion como leida", async () => {
    const env = createEnv();

    const createResponse = await worker.fetch(
      new Request("http://localhost/notifications", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          userId: "reader-1",
          tipo: "PEDIDO_ENTREGADO",
          mensaje: "Tu pedido fue entregado",
        }),
      }),
      env,
      {} as ExecutionContext,
    );

    const created = (await createResponse.json()) as { id: string };

    const patchResponse = await worker.fetch(
      new Request(`http://localhost/notifications/${created.id}/leer`, {
        method: "PATCH",
        headers: {
          "x-service-token": "test-service-token",
          "authorization": `Bearer ${jwtReaderOne}`,
        },
      }),
      env,
      {} as ExecutionContext,
    );

    const patched = (await patchResponse.json()) as { leida: boolean; readAt: string | null };

    expect(patchResponse.status).toBe(200);
    expect(patched.leida).toBe(true);
    expect(typeof patched.readAt).toBe("string");
  });

  it("responde health", async () => {
    const env = createEnv();
    const response = await worker.fetch(
      new Request("http://localhost/health", {
        headers: { "x-service-token": "test-service-token" },
      }),
      env,
      {} as ExecutionContext,
    );

    const body = (await response.json()) as { status: string; service: string };

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.service).toBe("notificaciones-service");
  });
});
