import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { COOKIE_NAME } from "@shared/const";
import * as db from "../db";
import { verifyLocalSessionToken } from "./session";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

function parseCookieHeader(cookieHeader: string | undefined): Map<string, string> {
  const map = new Map<string, string>();
  if (!cookieHeader) return map;
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) map.set(key, decodeURIComponent(value));
  }
  return map;
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    const cookies = parseCookieHeader(opts.req.headers.cookie);
    const token = cookies.get(COOKIE_NAME);
    const session = await verifyLocalSessionToken(token);

    if (session?.userId) {
      const dbUser = await db.getUserById(session.userId);
      if (dbUser) {
        user = dbUser;
      }
    }
  } catch (error) {
    console.warn("[Auth] Failed to resolve session user:", error);
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
