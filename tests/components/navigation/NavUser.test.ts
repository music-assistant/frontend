import NavUser from "@/components/navigation/NavUser.vue";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { buttonHost, logout, routerPush, setOpenMobile, slotHost } = vi.hoisted(
  () => ({
    // the menu's shell is reka's to test; the items only have to be clickable
    buttonHost: { template: "<button><slot /></button>" },
    slotHost: { template: "<div><slot /></div>" },
    logout: vi.fn(),
    routerPush: vi.fn(),
    setOpenMobile: vi.fn(),
  }),
);

vi.mock("@/plugins/store", async () => {
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  return {
    store: reactive({
      currentUser: { username: "sam", display_name: "Sam" },
      navMenuEditMode: false,
      isIngressSession: false,
    }),
  };
});

vi.mock("@/plugins/auth", () => ({ authManager: { logout } }));

vi.mock("@/plugins/api", () => ({
  api: {
    serverInfo: { value: null },
    transportState: { value: "initialized" },
  },
}));

vi.mock("vue-i18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock("@/composables/useScrobblingStatus", async () => {
  const { ref } = await import("vue");
  return {
    useScrobblingStatus: () => ({
      status: ref({ configured: false, providerNames: [] }),
      providerSummary: ref(""),
    }),
  };
});

vi.mock("@/composables/useAccountSwitcher", () => ({
  useAccountSwitcher: () => ({
    availableAccounts: [],
    loadAccounts: vi.fn(),
    openAccountSwitcher: vi.fn(),
    selectAccount: vi.fn(),
  }),
}));

vi.mock("@/composables/userPreferences", () => ({
  runAfterPreferenceWrites: (task: () => Promise<unknown>) => task(),
}));

vi.mock("@/components/profile/ProfileAvatarEditor.vue", () => ({
  default: { template: "<div />" },
}));

vi.mock("vue-router", () => ({ useRouter: () => ({ push: routerPush }) }));

vi.mock("@/components/ui/sidebar", () => ({
  SidebarMenu: slotHost,
  SidebarMenuItem: slotHost,
  SidebarMenuButton: buttonHost,
  useSidebar: () => ({ isMobile: { value: true }, setOpenMobile }),
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: slotHost,
  DropdownMenuTrigger: slotHost,
  DropdownMenuContent: {
    name: "DropdownMenuContent",
    emits: ["closeAutoFocus"],
    template: "<div><slot /></div>",
  },
  DropdownMenuItem: buttonHost,
  DropdownMenuLabel: slotHost,
  DropdownMenuSeparator: { template: "<hr />" },
  DropdownMenuSub: slotHost,
  DropdownMenuSubTrigger: slotHost,
  DropdownMenuSubContent: slotHost,
}));

vi.mock("@/components/ui/avatar", () => ({
  Avatar: slotHost,
  AvatarImage: { template: "<img />" },
  AvatarFallback: slotHost,
}));

enableAutoUnmount(afterEach);

beforeEach(() => {
  logout.mockReset();
  routerPush.mockReset();
  setOpenMobile.mockReset();
});

function mountMenu() {
  return mount(NavUser, {
    global: { mocks: { $t: (key: string) => key } },
  });
}

describe("NavUser", () => {
  it("is the tour's stop for the profile", () => {
    const wrapper = mountMenu();

    expect(wrapper.find("[data-tour=profile]").exists()).toBe(true);
  });
});
