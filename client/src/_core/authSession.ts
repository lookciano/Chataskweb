const AUTH_SESSION_TOKEN_KEY = "chatask.sessionToken";

type SessionTokenPayload = {
  sessionToken?: string | null;
};

export function getAuthSessionToken(): string | null {
  try {
    return window.localStorage.getItem(AUTH_SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthSessionToken(token: string | null | undefined) {
  try {
    if (token) {
      window.localStorage.setItem(AUTH_SESSION_TOKEN_KEY, token);
    } else {
      window.localStorage.removeItem(AUTH_SESSION_TOKEN_KEY);
    }
  } catch {
    // Storage can be unavailable in restricted WebView modes.
  }
}

export function persistSessionTokenFromResponse<T>(value: T): T {
  const token =
    value && typeof value === "object"
      ? (value as SessionTokenPayload).sessionToken
      : null;

  if (token) {
    setAuthSessionToken(token);
  }

  return value;
}

