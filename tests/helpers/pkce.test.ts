import { createCodeChallenge, createCodeVerifier } from "@/helpers/pkce";
import { describe, expect, it } from "vitest";

describe("pkce", () => {
  it("derives the S256 challenge of the RFC 7636 appendix B example", async () => {
    expect(
      await createCodeChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
    ).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("creates a new unpadded base64url verifier of 43 characters", () => {
    const verifier = createCodeVerifier();

    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(createCodeVerifier()).not.toBe(verifier);
  });
});
