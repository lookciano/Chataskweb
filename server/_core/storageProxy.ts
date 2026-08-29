import type { Express, Request, Response } from "express";
import { ENV } from "./env";
import { verifyLocalSessionToken } from "./session";
import { COOKIE_NAME } from "@shared/const";

function getCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie || "";
  const part = header.split(";").map((value) => value.trim()).find((value) => value.startsWith(`${name}=`));
  return part ? decodeURIComponent(part.slice(name.length + 1)) : undefined;
}

function isSafeStorageKey(key: string): boolean {
  return key.length <= 512 && !key.includes("..") && !key.startsWith("/") && !key.includes("\\") && /^[A-Za-z0-9_./-]+$/.test(key);
}

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req: Request, res: Response) => {
    const session = await verifyLocalSessionToken(getCookie(req, COOKIE_NAME));
    if (!session) {
      res.status(401).send("Authentication required");
      return;
    }
    const key = (req.params as Record<string, string>)[0];
    if (!key || !isSafeStorageKey(key)) {
      res.status(400).send("Invalid storage key");
      return;
    }
    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(503).send("Storage unavailable");
      return;
    }
    try {
      const forgeUrl = new URL("v1/storage/presign/get", ENV.forgeApiUrl.replace(/\/+$/, "") + "/");
      forgeUrl.searchParams.set("path", key);
      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: ['Bearer ', ENV.forgeApiKey].join("") },
        signal: AbortSignal.timeout(10_000),
      });
      if (!forgeResp.ok) {
        console.error(`[StorageProxy] upstream status=${forgeResp.status}`);
        res.status(502).send("Storage backend error");
        return;
      }
      const payload = (await forgeResp.json()) as { url?: string };
      if (!payload.url) {
        res.status(502).send("Storage backend error");
        return;
      }
      const signedUrl = new URL(payload.url);
      if (signedUrl.protocol !== "https:") {
        res.status(502).send("Storage backend error");
        return;
      }
      res.set("Cache-Control", "no-store");
      res.redirect(307, signedUrl.toString());
    } catch (error) {
      console.error("[StorageProxy] request failed", error instanceof Error ? error.name : "unknown");
      res.status(502).send("Storage proxy error");
    }
  });
}
