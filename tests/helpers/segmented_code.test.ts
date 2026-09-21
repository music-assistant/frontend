import {
  REMOTE_ID_GROUPS,
  formatRemoteId,
  sanitizeCode,
  splitCode,
} from "@/helpers/segmented_code";
import { describe, expect, it } from "vitest";

describe("segmented code", () => {
  it("sanitizes a code", () => {
    expect(sanitizeCode("ab-cd 12")).toBe("ABCD12");
    expect(sanitizeCode("ab-cd 12", true)).toBe("12");
  });

  it("splits a code into the requested segment lengths", () => {
    expect(splitCode("abcdef", [2, 4])).toEqual(["AB", "CDEF"]);
  });

  it("formats a remote access ID into its 8-5-5-8 groups", () => {
    expect(REMOTE_ID_GROUPS).toEqual([8, 5, 5, 8]);
    expect(formatRemoteId("abcdefghijklmnopqrstuvwxyz")).toBe(
      "ABCDEFGH-IJKLM-NOPQR-STUVWXYZ",
    );
  });
});
