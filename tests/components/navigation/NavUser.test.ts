import NavUser from "@/components/navigation/NavUser.vue";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { buttonHost, logout, routerPush, setOpenMobile, slotHost, startTour } =
  vi.hoisted(() => ({
    // the menu's shell is reka's to test; the items only have to be clickable
    buttonHost: { template: "<button><slot /></button>" },
    slotHost: { template: "<div><slot /></div>" },
    logout: vi.fn(),
    routerPush: vi.fn(),
    setOpenMobile: vi.fn(),
    startTour: vi.fn(),
  }));

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

vi.mock("vue-router", () => ({ useRouter: () => ({ push: routerPush }) }));

vi.mock("@/composables/useTour", () => ({
  useTour: () => ({ start: startTour }),
}));

vi.mock("@/components/ui/sidebar", () => ({
  SidebarMenu: slotHost,
  SidebarMenuItem: slotHost,
  SidebarMenuButton: buttonHost,
  useSidebar: () => ({ isMobile: { value: true }, setOpenMobile }),
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: slotHost,
  DropdownMenuTrigger: slotHost,
  DropdownMenuContent: slotHost,
  DropdownMenuItem: buttonHost,
  DropdownMenuLabel: slotHost,
  DropdownMenuSeparator: { template: "<hr />" },
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
  startTour.mockReset();
});

function mountMenu() {
  return mount(NavUser, {
    global: { mocks: { $t: (key: string) => key } },
  });
}

describe("NavUser", () => {
  it("starts the tour from the menu, out from under the sidebar sheet", async () => {
    const wrapper = mountMenu();

    await wrapper.find("[data-testid=nav-user-tour]").trigger("click");

    // the sheet would cover the very things the tour points at
    expect(setOpenMobile).toHaveBeenCalledWith(false);
    expect(startTour).toHaveBeenCalledTimes(1);
  });

  it("is the tour's stop for the profile", () => {
    const wrapper = mountMenu();

    expect(wrapper.find("[data-tour=profile]").exists()).toBe(true);
  });
});
