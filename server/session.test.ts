import { describe, expect, it } from "vitest";
import { createLocalSessionToken, verifyLocalSessionToken } from "./_core/session";

describe("local session tokens", () => {
  it("round-trips user identity claims", async () => {
    process.env.JWT_SECRET = "test-secret-for-session-roundtrip-32chars";

    const token = await createLocalSessionToken({
      openId: "4vg47RAdrAwNyqAZGQ8nd4",
      name: "Luciano",
      userId: 1,
    });

    const session = await verifyLocalSessionToken(token);
    expect(session).toMatchObject({
      openId: "4vg47RAdrAwNyqAZGQ8nd4",
      name: "Luciano",
      userId: 1,
    });
  });

  it("rejects missing token", async () => {
    expect(await verifyLocalSessionToken(null)).toBeNull();
    expect(await verifyLocalSessionToken(undefined)).toBeNull();
  });
});
