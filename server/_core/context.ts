import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import * as db from "../db";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

// Default anonymous user for open access (no login required)
const DEFAULT_USER = {
  id: 1,
  openId: "anonymous",
  name: "Usuário",
  email: null,
  loginMethod: null,
  role: "admin" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
  displayName: "Usuário",
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  // Open access: always return the default user
  // No OAuth, no login required
  return {
    req: opts.req,
    res: opts.res,
    user: DEFAULT_USER as any,
  };
}
