import type { Request, Response, NextFunction } from "express";
import { TRPCError } from "@trpc/server";

export type RateLimitRule = {
  windowMs: number;
  max: number;
  key?: (req: Request) => string;
};

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function defaultKey(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = typeof forwarded === "string" ? forwarded.split(",")[0].trim() : req.ip;
  return ip || "unknown";
}

export function createRateLimit(name: string, rule: RateLimitRule) {
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = `${name}:${(rule.key || defaultKey)(req)}`;
    const current = buckets.get(key);
    const bucket = !current || current.resetAt <= now
      ? { count: 0, resetAt: now + rule.windowMs }
      : current;

    bucket.count += 1;
    buckets.set(key, bucket);
    res.setHeader("X-RateLimit-Limit", String(rule.max));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, rule.max - bucket.count)));

    if (bucket.count > rule.max) {
      res.setHeader("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
      res.status(429).json({ error: "Muitas tentativas. Tente novamente mais tarde." });
      return;
    }
    next();
  };
}

const dailyReportCounts = new Map<string, { day: string; count: number }>();

export function consumeDailyReportLimit(userId: number, max = 3): void {
  const day = new Date().toISOString().slice(0, 10);
  const key = String(userId);
  const current = dailyReportCounts.get(key);
  const entry = !current || current.day !== day ? { day, count: 0 } : current;
  if (entry.count >= max) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Limite diário de relatórios atingido. Você pode gerar no máximo 3 relatórios por dia.",
    });
  }
  entry.count += 1;
  dailyReportCounts.set(key, entry);
}

export function resetRateLimitStateForTests() {
  buckets.clear();
  dailyReportCounts.clear();
}
