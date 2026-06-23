import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/sidebar", () => ({
  useSidebar: vi.fn(() => ({ state: { value: "expanded" } })),
}));

import { applySidebarScrollbarGutter } from "@/composables/useSidebarScrollbarGutter";

interface SidebarDomOptions {
  scrollHeight?: number;
  clientHeight?: number;
}

function createSidebarDom({
  scrollHeight = 0,
  clientHeight = 0,
}: SidebarDomOptions = {}) {
  const sidebarEl = document.createElement("div");
  sidebarEl.setAttribute("data-slot", "sidebar");

  const contentEl = document.createElement("div");
  contentEl.setAttribute("data-slot", "sidebar-content");
  Object.defineProperty(contentEl, "scrollHeight", {
    get: () => scrollHeight,
    configurable: true,
  });
  Object.defineProperty(contentEl, "clientHeight", {
    get: () => clientHeight,
    configurable: true,
  });

  const navEl = document.createElement("div");

  sidebarEl.appendChild(contentEl);
  contentEl.appendChild(navEl);

  return { sidebarEl, contentEl, navEl };
}

describe("applySidebarScrollbarGutter", () => {
  it("does nothing when navEl is null", () => {
    expect(() => applySidebarScrollbarGutter(null, true)).not.toThrow();
  });

  it("does nothing when navEl has no sidebar ancestor", () => {
    const navEl = document.createElement("div");
    expect(() => applySidebarScrollbarGutter(navEl, true)).not.toThrow();
  });

  it("sets --sidebar-width-icon when collapsed and overflowing", () => {
    const { sidebarEl, navEl } = createSidebarDom({
      scrollHeight: 200,
      clientHeight: 100,
    });

    applySidebarScrollbarGutter(navEl, true);

    expect(sidebarEl.style.getPropertyValue("--sidebar-width-icon")).toBe(
      "calc(3rem + 6px)",
    );
  });

  it("sets scrollbarGutter to stable when collapsed and overflowing", () => {
    const { contentEl, navEl } = createSidebarDom({
      scrollHeight: 200,
      clientHeight: 100,
    });

    applySidebarScrollbarGutter(navEl, true);

    expect(contentEl.style.scrollbarGutter).toBe("stable");
  });

  it("removes --sidebar-width-icon when not overflowing", () => {
    const { sidebarEl, navEl } = createSidebarDom({
      scrollHeight: 100,
      clientHeight: 100,
    });
    sidebarEl.style.setProperty("--sidebar-width-icon", "calc(3rem + 6px)");

    applySidebarScrollbarGutter(navEl, true);

    expect(sidebarEl.style.getPropertyValue("--sidebar-width-icon")).toBe("");
  });

  it("clears scrollbarGutter when not overflowing", () => {
    const { contentEl, navEl } = createSidebarDom({
      scrollHeight: 100,
      clientHeight: 100,
    });
    contentEl.style.scrollbarGutter = "stable";

    applySidebarScrollbarGutter(navEl, true);

    expect(contentEl.style.scrollbarGutter).toBe("");
  });

  it("removes --sidebar-width-icon when expanded even if content overflows", () => {
    const { sidebarEl, navEl } = createSidebarDom({
      scrollHeight: 200,
      clientHeight: 100,
    });
    sidebarEl.style.setProperty("--sidebar-width-icon", "calc(3rem + 6px)");

    applySidebarScrollbarGutter(navEl, false);

    expect(sidebarEl.style.getPropertyValue("--sidebar-width-icon")).toBe("");
  });

  it("does not accumulate --sidebar-width-icon on repeated calls", () => {
    const { sidebarEl, navEl } = createSidebarDom({
      scrollHeight: 200,
      clientHeight: 100,
    });

    applySidebarScrollbarGutter(navEl, true);
    applySidebarScrollbarGutter(navEl, true);
    applySidebarScrollbarGutter(navEl, true);

    expect(sidebarEl.style.getPropertyValue("--sidebar-width-icon")).toBe(
      "calc(3rem + 6px)",
    );
  });

  it("resets and reapplies correctly when toggling between collapsed states", () => {
    const { sidebarEl, navEl } = createSidebarDom({
      scrollHeight: 200,
      clientHeight: 100,
    });

    applySidebarScrollbarGutter(navEl, true);
    expect(sidebarEl.style.getPropertyValue("--sidebar-width-icon")).toBe(
      "calc(3rem + 6px)",
    );

    // Expand → clears
    applySidebarScrollbarGutter(navEl, false);
    expect(sidebarEl.style.getPropertyValue("--sidebar-width-icon")).toBe("");

    // Collapse again → re-applies from base
    applySidebarScrollbarGutter(navEl, true);
    expect(sidebarEl.style.getPropertyValue("--sidebar-width-icon")).toBe(
      "calc(3rem + 6px)",
    );
  });
});
