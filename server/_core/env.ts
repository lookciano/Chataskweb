const isProduction = process.env.NODE_ENV === "production";

if (isProduction && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is required in production");
}

if (isProduction && !process.env.ROOM_ADMIN_PASSWORD) {
  throw new Error("ROOM_ADMIN_PASSWORD is required in production");
}

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "chataskweb",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction,
  enableDebugEndpoints: process.env.ENABLE_DEBUG_ENDPOINTS === "true",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env["BUILT_IN_FORGE_API_KEY"] ?? "",
  openrouterApiKey: process.env["OPENROUTER_API_KEY"] ?? "",
  openrouterModel: process.env.OPENROUTER_MODEL ?? "deepseek/deepseek-chat",
  appUrl: process.env.APP_URL ?? "https://chataskweb.onrender.com",
  // Kept in the server environment only. Never duplicate it in client code.
  roomAdminPassword: process.env.ROOM_ADMIN_PASSWORD ?? "",
};
