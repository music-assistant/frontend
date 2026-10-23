import NavHeaderMenu from "@/components/navigation/NavHeaderMenu.vue";
import { enableAutoUnmount, shallowMount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { setOpenMobile, startTour, tourState } = vi.hoisted(() => ({
  setOpenMobile: vi.fn(),
  startTour: vi.fn(),
  tourState: { active: { value: false } as { value: boolean } },
}));

vi.mock("@/plugins/store", () => ({ store: { serverInfo: null } }));
vi.mock("@/plugins/api", () => ({
  api: {
    serverInfo: { value: null },
    transportState: { value: "initialized" },
  },
}));
vi.mock("vue-router", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("vue-i18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));
vi.mock("@/composables/usePwaUpdate", () => ({
  usePwaUpdate: () => ({
    needRefresh: { value: false },
    updateServiceWorker: vi.fn(),
  }),
}));
vi.mock("@/composables/useTour", async () => {
  const { ref } = await vi.importActual<typeof import("vue")>("vue");
  tourState.active = ref(false);
  return { useTour: () => ({ active: tourState.active, start: startTour }) };
});
vi.mock("@/components/ui/sidebar", () => ({
  useSidebar: () => ({ isMobile: { value: true }, setOpenMobile }),
}));
vi.mock("@/components/ui/button", () => ({
  Button: { template: "<button><slot /></button>" },
}));
vi.mock("@/components/ui/dialog", () => {
  const slotHost = { template: "<div><slot /></div>" };
  return {
    Dialog: slotHost,
    DialogContent: slotHost,
    DialogDescription: slotHost,
    DialogHeader: slotHost,
    DialogTitle: slotHost,
  };
});
vi.mock("@/components/navigation/NavLanguageMenu.vue", () => ({
  default: { template: "<div />" },
}));
vi.mock("@/components/navigation/NavKeyboardShortcuts.vue", () => ({
  default: { template: "<div />" },
}));
vi.mock("@/components/navigation/NavSidebarMenu.vue", () => ({
  default: { template: "<div />" },
}));
vi.mock("@/components/navigation/NavThemeMenu.vue", () => ({
  default: { template: "<div />" },
}));

enableAutoUnmount(afterEach);

beforeEach(() => {
  setOpenMobile.mockReset();
  startTour.mockReset();
  tourState.active.value = false;
});

function mountMenu() {
  return shallowMount(NavHeaderMenu, {
    global: {
      renderStubDefaultSlot: true,
      mocks: { $t: (key: string) => key },
    },
  });
}

function closeMenu(wrapper: ReturnType<typeof mountMenu>) {
  const closing = new Event("closeAutoFocus", { cancelable: true });
  wrapper
    .findComponent({ name: "DropdownMenuContent" })
    .vm.$emit("closeAutoFocus", closing);
  return closing.defaultPrevented;
}

describe("NavHeaderMenu tour", () => {
  it("starts the tour from the top menu after closing the sidebar sheet", async () => {
    const wrapper = mountMenu();

    await wrapper.find("[data-testid=nav-header-tour]").trigger("click");

    expect(setOpenMobile).toHaveBeenCalledWith(false);
    expect(startTour).toHaveBeenCalledTimes(1);
  });

  it("leaves focus with the tour when the menu closes behind it", () => {
    const wrapper = mountMenu();
    tourState.active.value = true;

    expect(closeMenu(wrapper)).toBe(true);
  });

  it("returns focus normally when no tour is active", () => {
    expect(closeMenu(mountMenu())).toBe(false);
  });
});
