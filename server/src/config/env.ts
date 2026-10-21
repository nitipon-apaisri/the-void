const MIN_AUTH_SECRET_LENGTH = 32;

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required; copy .env.example to .env`);
  return value;
}

const authSecret = required("AUTH_SECRET");
if (authSecret.length < MIN_AUTH_SECRET_LENGTH) {
  throw new Error(`AUTH_SECRET must be at least ${MIN_AUTH_SECRET_LENGTH} characters`);
}

export const env = {
  port: Number(process.env.PORT ?? 2567),
  databaseUrl: required("DATABASE_URL"),
  authSecret,
  // Browser origins allowed to call the HTTP API (the Vite dev server, the packaged client).
  corsOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  // Proxy hops in front of the server; needed so rate limits see the real client address.
  trustProxyHops: Number(process.env.TRUST_PROXY_HOPS ?? 0),
  livekit: {
    // URL the browser connects to (ws/wss), not the server-to-server one.
    url: process.env.LIVEKIT_URL ?? "",
    apiKey: process.env.LIVEKIT_API_KEY ?? "",
    apiSecret: process.env.LIVEKIT_API_SECRET ?? "",
  },
};
