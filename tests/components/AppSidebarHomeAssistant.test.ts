import AppSidebar from "@/components/navigation/AppSidebar.vue";
import { enableAutoUnmount, shallowMount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

const { haStateMock } = vi.hoisted(() => ({
  haStateMock: { kioskModeEnabled: false },
}));

vi.mock("@/plugins/homeassistant", () => ({ haState: haStateMock }));

vi.mock("@/plugins/eventbus", () => ({
  eventbus: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
}));

vi.mock("@/plugins/store", async () => {
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  return { store: reactive({ navMenuEditMode: false, mobileLayout: false }) };
});

vi.mock("@/composables/useThemePreference", () => ({
  useThemePreference: () => ({
    isDarkTheme: { value: false },
    setThemePreference: vi.fn(),
  }),
}));

vi.mock("@/components/navigation/utils/getMenuItems", () => ({
  getMenuItems: () => [],
  resolveMenuConfig: () => ({ sections: {} }),
}));

// The sidebar shell drags the api and i18n plugins in behind it; only the slots
// and the collapsed/mobile state matter here.
vi.mock("@/components/ui/sidebar", () => {
  const slotHost = { template: "<div><slot /></div>" };
  return {
    Sidebar: slotHost,
    SidebarContent: slotHost,
    SidebarFooter: slotHost,
    SidebarHeader: slotHost,
    SidebarMenu: slotHost,
    SidebarMenuItem: slotHost,
    SidebarTrigger: slotHost,
    useSidebar: () => ({
      toggleSidebar: vi.fn(),
      setOpen: vi.fn(),
      state: { value: "expanded" },
      isMobile: { value: false },
    }),
  };
});

// These reach for the api plugin on import, which the vue-i18n mock cannot serve.
vi.mock("@/components/navigation/NavMain.vue", () => ({
  default: { template: "<div />" },
}));
vi.mock("@/components/navigation/NavShortcuts.vue", () => ({
  default: { template: "<div />" },
}));
vi.mock("@/components/navigation/NavMobile.vue", () => ({
  default: { template: "<div />" },
}));

vi.mock("vue-router", () => ({ useRouter: () => ({ push: vi.fn() }) }));

vi.mock("vue-i18n", () => ({
  createI18n: () => ({ global: { t: (key: string) => key } }),
  useI18n: () => ({ t: (key: string) => key }),
}));

enableAutoUnmount(afterEach);

afterEach(() => {
  haStateMock.kioskModeEnabled = false;
});

function hasHomeAssistantButton() {
  const wrapper = shallowMount(AppSidebar, {
    global: { renderStubDefaultSlot: true },
  });
  return wrapper.find("nav-home-assistant-stub").exists();
}

describe("AppSidebar Home Assistant button", () => {
  it("offers the way back while kiosk mode holds the whole screen", () => {
    haStateMock.kioskModeEnabled = true;

    expect(hasHomeAssistantButton()).toBe(true);
  });

  it("leaves it out while Home Assistant shows its own menu", () => {
    // Home Assistant is already reachable, and off kiosk mode this same button
    // would dock or undock its sidebar rather than open it.
    expect(hasHomeAssistantButton()).toBe(false);
  });
});
