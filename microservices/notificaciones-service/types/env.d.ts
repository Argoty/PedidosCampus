interface Env {
  // Binding declarado en wrangler.toml para acceder al namespace KV.
  NOTIFICATIONS: KVNamespace;
  SERVICE_TOKEN: string;
}
