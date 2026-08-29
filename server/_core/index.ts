import "dotenv/config";
import express from "express";
import cors from "cors";
import { ENV } from "./env";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
// OAuth disabled - open access mode
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { handleWeeklySummarySchedule } from "../scheduled-weekly-summary";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Render / reverse proxies terminate TLS; needed for secure cookies + correct protocol.
  app.set("trust proxy", 1);
  // Keep ordinary API payloads bounded; uploads must use a dedicated flow.
  app.use(express.json({ limit: "256kb" }));
  app.use(express.urlencoded({ limit: "256kb", extended: true }));

  // Reflect only explicitly trusted origins when credentials are enabled.
  const allowedOrigins = new Set([
    ENV.appUrl || "https://chataskweb.onrender.com",
    ...(process.env.NODE_ENV === "development" ? ["http://localhost:5173", "http://localhost:3000"] : []),
    "capacitor://localhost",
    "https://localhost",
    "http://localhost",
  ]);
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.has(origin)) return callback(null, true);
        return callback(new Error("Origin not allowed"));
      },
      credentials: true,
    })
  );
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    next();
  });

  registerStorageProxy(app);
  // Local JWT identity replaces Manus OAuth (select existing team member).
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  
  // Scheduled handlers
  app.post("/api/scheduled/weekly-summary", handleWeeklySummarySchedule);
  
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000", 10);
  // On Render/production the platform injects PORT and health-checks that exact port.
  // Never silently switch ports in production or the service will fail health checks.
  const port =
    process.env.NODE_ENV === "production"
      ? preferredPort
      : await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${port}/`);
  });
}

startServer().catch(console.error);
