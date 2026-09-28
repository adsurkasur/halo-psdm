import { describe, expect, it } from "vitest";
import { normalizeBasePath, withBase } from "./base-path";

describe("base path (Multi-Zones)", () => {
  it("empty base path keeps root-relative URLs unchanged (standalone production)", () => {
    expect(normalizeBasePath(undefined)).toBe("");
    expect(withBase("/api/secure/reports", "")).toBe("/api/secure/reports");
  });

  it("zone base path prefixes root-relative URLs only", () => {
    const base = normalizeBasePath("/app/halo-psdm/");
    expect(base).toBe("/app/halo-psdm");
    expect(withBase("/api/secure/chat/media", base)).toBe("/app/halo-psdm/api/secure/chat/media");
    expect(withBase("https://example.supabase.co/x", base)).toBe("https://example.supabase.co/x");
  });

  it("rejects malformed values", () => {
    expect(() => normalizeBasePath("app/halo-psdm")).toThrow();
  });
});
