import navHeaderSource from "@/components/navigation/NavHeaderMenu.vue?raw";
import navSidebarMenuSource from "@/components/navigation/NavSidebarMenu.vue?raw";
import navUserSource from "@/components/navigation/NavUser.vue?raw";
import accountSwitcherSource from "@/components/navigation/AccountSwitcherDialog.vue?raw";
import profileAvatarEditorSource from "@/components/profile/ProfileAvatarEditor.vue?raw";
import profileAvatarEditorDialogSource from "@/components/profile/ProfileAvatarEditorDialog.vue?raw";
import {
  accountAccentButtonClass,
  accountAccentButtonGlowClass,
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
    expect(accountAccentButtonGlowClass("Alice")).toMatch(/^bg-.*\/90$/);
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

  it("closes mobile navigation when settings is selected", () => {
    expect(navHeaderSource).toMatch(
      /const handleSettings = \(\) => \{\s*setOpenMobile\(false\);\s*router\.push\(\{ name: "settings" \}\);/,
    );
  });

  it("hides keyboard shortcuts from the mobile context menu", () => {
    expect(navHeaderSource).toContain('<template v-if="!isMobile">');
    expect(navHeaderSource).toContain("<NavKeyboardShortcuts />");
    expect(navSidebarMenuSource).toContain(
      '<Kbd v-if="!isMobile" class="ml-auto">',
    );
  });

  it("uses a full-screen sheet for account switching on mobile", () => {
    expect(accountSwitcherSource).toContain(':is="isMobile ? Sheet : Dialog"');
    expect(accountSwitcherSource).toContain("SheetContent");
    expect(accountSwitcherSource).toContain(
      "h-dvh max-h-dvh w-full max-w-none",
    );
  });

  it("uses a full-screen avatar editor sheet on mobile", () => {
    expect(profileAvatarEditorDialogSource).toContain(
      ':is="isMobile ? Sheet : Dialog"',
    );
    expect(profileAvatarEditorDialogSource).toContain(
      "h-dvh max-h-dvh w-full max-w-none",
    );
    expect(profileAvatarEditorSource).toContain("openAvatarEditor");
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
    expect(navUserSource).toContain("text-foreground truncate text-lg");
    expect(navUserSource).not.toContain("text-lg font-semibold text-white");
    expect(
      navUserSource.match(/currentAccountAccentClass/g)?.length,
    ).toBeGreaterThanOrEqual(5);
  });

  it("closes the mobile sidebar before opening the account switcher", () => {
    expect(navUserSource).toMatch(
      /const openAccountSwitcher = \(\) => \{\s*accountMenuOpen\.value = false;\s*if \(isMobile\.value\) \{\s*setOpenMobile\(false\);/,
    );
  });

  it("renders scrobbling as a separate status signal around the avatar", () => {
    expect(navUserSource).toContain("scrobblingStatus.configured");
    expect(navUserSource).toContain("scrobbling-avatar-glow");
    expect(navUserSource).toContain("account-profile-avatar-backdrop");
    expect(navUserSource).toContain("rounded-full bg-popover");
    expect(navUserSource).toContain('avatar-class="size-20"');
    expect(navUserSource).not.toContain("size-20 border-4");
    expect(navUserSource).toContain('role="status"');
    expect(navUserSource).toContain("auth.scrobbling");
  });

  it("uses a subtle background pulse instead of a border or spinner", () => {
    expect(navUserSource).not.toContain("border-emerald-400/90");
    expect(navUserSource).not.toContain("animate-spin");
    expect(navUserSource).toContain("scrobbling-avatar-pulse");
    expect(navUserSource).toContain("scrobbling-avatar-glow-base");
    expect(navUserSource).toContain("scrobbling-avatar-glow--active");
    expect(navUserSource).not.toContain("filter: brightness");
    expect(navUserSource).toContain("prefers-reduced-motion: reduce");
  });

  it("lets the avatar glow extend beyond the menu button", () => {
    expect(navUserSource).toContain("w-full overflow-visible");
  });

  it("uses the shared press feedback on the footer account menu button", () => {
    expect(navUserSource).toContain(':ripple="true"');
  });

  it("keeps the collapsed account trigger avatar-sized and round", () => {
    expect(navUserSource).toContain(
      "group-data-[collapsible=icon]:h-[34px]! group-data-[collapsible=icon]:w-[34px]!",
    );
    expect(navUserSource).toContain(
      "group-data-[collapsible=icon]:rounded-full! group-data-[collapsible=icon]:p-0!",
    );
    expect(navUserSource).toContain(
      "group-data-[collapsible=icon]:justify-self-center",
    );
  });

  it("uses the sidebar active colors for the account menu trigger", () => {
    expect(navUserSource).toContain(
      "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
    );
    expect(navUserSource).toContain(
      "data-[state=open]:bg-sidebar-active data-[state=open]:text-sidebar-accent-foreground",
    );
  });

  it("detects scrobbling independently of account credentials", () => {
    expect(isScrobblingProvider).toBeTypeOf("function");
    expect(getScrobblingStatus([]).configured).toBe(false);
  });
});
