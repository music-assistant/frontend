import {
  getLucideIcon,
  PLAYER_ICON_FALLBACK,
  PLAYER_ICON_IDS,
  PLAYER_ICON_OPTIONS,
} from "@/helpers/icon";
import { describe, expect, it } from "vitest";

describe("icon helpers", () => {
  describe("getLucideIcon", () => {
    it("returns undefined for null/undefined", () => {
      expect(getLucideIcon(null)).toBeUndefined();
      expect(getLucideIcon(undefined)).toBeUndefined();
    });

    it("returns undefined for values outside the set", () => {
      expect(getLucideIcon("mdi-speaker")).toBeUndefined();
      expect(getLucideIcon("some-random-icon")).toBeUndefined();
    });

    it("resolves every canonical manifest id to a component", () => {
      for (const id of PLAYER_ICON_IDS) {
        expect(
          getLucideIcon(id),
          `manifest id "${id}" must resolve`,
        ).toBeDefined();
      }
    });

    it("resolves custom MA icons", () => {
      expect(getLucideIcon("homepod-mini")).toBeDefined();
      expect(getLucideIcon("sonos")).toBeDefined();
      expect(getLucideIcon("wiim")).toBeDefined();
      expect(getLucideIcon("speakers")).toBeDefined();
    });

    it("resolves semantic ids to their mapped Lucide component", () => {
      expect(getLucideIcon("living-room")).toBeDefined();
      expect(getLucideIcon("kitchen")).toBeDefined();
      expect(getLucideIcon("vinyl")).toBeDefined();
    });

    it("resolves app icons outside the player set", () => {
      // AI-radio show preset icons.
      expect(getLucideIcon("sunrise")).toBeDefined();
      expect(getLucideIcon("disc-3")).toBeDefined();
      expect(getLucideIcon("book-open")).toBeDefined();
      expect(getLucideIcon("party-popper")).toBeDefined();
    });
  });

  describe("manifest", () => {
    it("exposes the canonical id list", () => {
      expect(PLAYER_ICON_IDS.length).toBeGreaterThanOrEqual(30);
      expect(PLAYER_ICON_IDS).toContain("speaker");
    });

    it("has a fallback that is a canonical id and resolves", () => {
      expect(PLAYER_ICON_IDS).toContain(PLAYER_ICON_FALLBACK);
      expect(getLucideIcon(PLAYER_ICON_FALLBACK)).toBeDefined();
    });

    it("provides display metadata for every id", () => {
      expect(PLAYER_ICON_OPTIONS.length).toBe(PLAYER_ICON_IDS.length);
      for (const option of PLAYER_ICON_OPTIONS) {
        expect(
          option.name,
          `id "${option.id}" must have a display name`,
        ).toBeTruthy();
        expect(Array.isArray(option.keywords)).toBe(true);
      }
    });
  });
});
