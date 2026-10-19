import { beforeEach, describe, expect, it } from "vitest";
import { resetEnvForTests } from "@/config/env";
import { clearRefreshCookie, readCookie, setRefreshCookie } from "./cookies";
import { hashOpaqueToken, newRefreshToken, signAccessToken, verifyAccessToken } from "./tokens";

beforeEach(() => {
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
  process.env.JWT_SECRET = "a-test-secret-with-at-least-thirty-two-characters";
  Object.assign(process.env, { NODE_ENV: "test" });
  resetEnvForTests();
});

describe("authentication tokens", () => {
  it("round-trips signed access claims", async () => {
    const token = await signAccessToken({ userId: crypto.randomUUID(), tenantId: crypto.randomUUID(), roleId: crypto.randomUUID(), role: "SCHOOL_ADMIN", permissions: ["students:write"], sessionId: crypto.randomUUID() });
    const claims = await verifyAccessToken(token);
    expect(claims.role).toBe("SCHOOL_ADMIN");
    expect(claims.permissions).toEqual(["students:write"]);
  });

  it("creates high-entropy opaque refresh values and one-way hashes", () => {
    const first = newRefreshToken(); const second = newRefreshToken();
    expect(first).not.toBe(second); expect(first.length).toBeGreaterThanOrEqual(64);
    expect(hashOpaqueToken(first)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("uses HttpOnly strict cookies and supports clearing", () => {
    const response = new Response(); setRefreshCookie(response, "secret");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("SameSite=Strict");
    expect(readCookie(new Request("http://test", { headers: { cookie: "x=1; edupresence_refresh=secret" } }), "edupresence_refresh")).toBe("secret");
    const cleared = new Response(); clearRefreshCookie(cleared); expect(cleared.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});
