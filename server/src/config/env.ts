export const env = {
  port: Number(process.env.PORT ?? 2567),
  livekit: {
    // URL the browser connects to (ws/wss), not the server-to-server one.
    url: process.env.LIVEKIT_URL ?? "",
    apiKey: process.env.LIVEKIT_API_KEY ?? "",
    apiSecret: process.env.LIVEKIT_API_SECRET ?? "",
  },
};
