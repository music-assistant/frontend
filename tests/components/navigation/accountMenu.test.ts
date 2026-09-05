import navHeaderSource from "@/components/navigation/NavHeaderMenu.vue?raw";
import navUserSource from "@/components/navigation/NavUser.vue?raw";
import {
  accountAccentButtonClass,
  accountAccentBackgroundClass,
  accountAccentClass,
  getConnectionStatusKey,
} from "@/components/navigation/accountMenu";
import {
  getScrobblingStatus,
  isScrobblingProvider,
} from "@/composables/useScrobblingStatus";
import { describe, expect, it } from "vitest";

describe("account menu helpers", () => {
  it("assigns a stable accent from the normalized username", () => {
    expect(accountAccentClass("Alice")).toBe(accountAccentClass(" alice "));
    expect(accountAccentClass("Alice")).not.toBe(accountAccentClass("Bob"));
    expect(accountAccentButtonClass("Alice")).toContain(
      "data-[state=open]:bg-",
    );
    expect(accountAccentButtonClass("Alice")).not.toMatch(/^bg-/);
    expect(accountAccentBackgroundClass("Alice")).toMatch(/^bg-.*\/60$/);
  });

  it("maps transport states to user-facing connection states", () => {
    expect(getConnectionStatusKey("initialized")).toBe("connected");
    expect(getConnectionStatusKey("reconnecting")).toBe("connecting");
    expect(getConnectionStatusKey("failed")).toBe("failed");
    expect(getConnectionStatusKey("disconnected")).toBe("disconnected");
  });

  it("keeps developer actions out of production builds", () => {
    expect(navHeaderSource).toContain(
      "const isDevelopment = import.meta.env.DEV",
    );
    expect(navHeaderSource).toContain('v-if="isDevelopment"');
  });

  it("uses release notes for the current server release and copies its version", () => {
    expect(navHeaderSource).toContain("releaseNotesUrl");
    expect(navHeaderSource).toContain("releases/tag/");
    expect(navHeaderSource).toContain('@click.stop="copyVersion"');
    expect(navHeaderSource).toContain("settings.release_notes");
  });

  it("copies only the current username from the account menu", () => {
    expect(navUserSource).toContain("copyToClipboard(username)");
    expect(navUserSource).not.toContain(
      "copyToClipboard(authManager.getToken())",
    );
    expect(navUserSource).toContain('role="status"');
    expect(navUserSource).toContain("group-hover:opacity-100");
    expect(navUserSource).toContain('@click.stop="copyUsername"');
  });

  it("uses the current account accent throughout the profile surface", () => {
    expect(navUserSource).toContain('class="h-20 rounded-t-md"');
    expect(navUserSource).toContain(':class="currentAccountAccentClass"');
    expect(
      navUserSource.match(/currentAccountAccentClass/g)?.length,
    ).toBeGreaterThanOrEqual(5);
  });

  it("renders scrobbling as a separate status signal around the avatar", () => {
    expect(navUserSource).toContain("scrobblingStatus.configured");
    expect(navUserSource).toContain("scrobbling-avatar-glow");
    expect(navUserSource).toContain('role="status"');
    expect(navUserSource).toContain("auth.scrobbling");
  });

  it("uses a subtle background pulse instead of a border or spinner", () => {
    expect(navUserSource).not.toContain("border-emerald-400/90");
    expect(navUserSource).not.toContain("animate-spin");
    expect(navUserSource).toContain("scrobbling-avatar-pulse");
    expect(navUserSource).toContain("scrobbling-avatar-glow-base");
    expect(navUserSource).toContain("scrobbling-avatar-glow--active");
    expect(navUserSource).toContain("prefers-reduced-motion: reduce");
  });

  it("detects scrobbling independently of account credentials", () => {
    expect(isScrobblingProvider).toBeTypeOf("function");
    expect(getScrobblingStatus([]).configured).toBe(false);
  });
});
