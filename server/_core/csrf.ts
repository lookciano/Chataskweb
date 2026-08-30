import type { NextFunction, Request, Response } from "express";

function originFromReferer(referer: string | undefined): string | undefined {
  if (!referer) return undefined;
  try {
    return new URL(referer).origin;
  } catch {
    return undefined;
  }
}

export function createOriginProtection(allowedOrigins: Set<string>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      next();
      return;
    }

    const origin = typeof req.headers.origin === "string"
      ? req.headers.origin
      : originFromReferer(typeof req.headers.referer === "string" ? req.headers.referer : undefined);

    // Non-browser/server-to-server requests do not carry Origin/Referer.
    // Browser requests with either header must match the configured origins.
    if (origin && !allowedOrigins.has(origin)) {
      res.status(403).json({ error: "Origem da requisição não autorizada" });
      return;
    }
    next();
  };
}
