import { SignJWT, jwtVerify } from "jose";
import { ENV } from "./env";
import { ONE_YEAR_MS } from "@shared/const";

export type LocalSessionPayload = {
  openId: string;
  appId: string;
  name: string;
  userId: number;
};

function getSessionSecret() {
  // Read live env so production secrets and tests both work after process boot.
  const secret =
    process.env.JWT_SECRET ||
    ENV.cookieSecret ||
    "chataskweb-dev-secret-change-me";
  return new TextEncoder().encode(secret);
}

export async function createLocalSessionToken(
  payload: Omit<LocalSessionPayload, "appId"> & { appId?: string },
  options: { expiresInMs?: number } = {}
): Promise<string> {
  const issuedAt = Date.now();
  const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
  const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);

  return new SignJWT({
    openId: payload.openId,
    appId: payload.appId || ENV.appId || "chataskweb",
    name: payload.name || "",
    userId: payload.userId,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt(Math.floor(issuedAt / 1000))
    .setExpirationTime(expirationSeconds)
    .sign(getSessionSecret());
}

export async function verifyLocalSessionToken(
  token: string | undefined | null
): Promise<LocalSessionPayload | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSessionSecret(), {
      algorithms: ["HS256"],
    });

    const openId = payload.openId;
    const appId = payload.appId;
    const name = payload.name;
    const userId = payload.userId;

    if (typeof openId !== "string" || !openId) return null;
    if (typeof userId !== "number" || !Number.isFinite(userId)) return null;

    return {
      openId,
      appId: typeof appId === "string" && appId ? appId : ENV.appId || "chataskweb",
      name: typeof name === "string" ? name : "",
      userId,
    };
  } catch (error) {
    console.warn("[Auth] Local session verification failed", String(error));
    return null;
  }
}
