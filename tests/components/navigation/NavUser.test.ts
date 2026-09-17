import NavUser from "@/components/navigation/NavUser.vue";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  buttonHost,
  logout,
  routerPush,
  setOpenMobile,
  slotHost,
  startTour,
  tourState,
} = vi.hoisted(() => ({
  // the menu's shell is reka's to test; the items only have to be clickable
  buttonHost: { template: "<button><slot /></button>" },
  slotHost: { template: "<div><slot /></div>" },
  logout: vi.fn(),
  routerPush: vi.fn(),
  setOpenMobile: vi.fn(),
  startTour: vi.fn(),
  // replaced with a ref by the tour mock factory below
  tourState: { active: { value: false } as { value: boolean } },
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

vi.mock("@/composables/useTour", async () => {
  const { ref } = await vi.importActual<typeof import("vue")>("vue");
  tourState.active = ref(false);
  return { useTour: () => ({ active: tourState.active, start: startTour }) };
});

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
  tourState.active.value = false;
});

/** What the menu does with focus as it closes. */
function closeMenu(wrapper: ReturnType<typeof mountMenu>) {
  const closing = new Event("closeAutoFocus", { cancelable: true });
  wrapper
    .findComponent({ name: "DropdownMenuContent" })
    .vm.$emit("closeAutoFocus", closing);
  return closing.defaultPrevented;
}

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

  it("leaves focus with the tour as it closes behind one", () => {
    const wrapper = mountMenu();
    tourState.active.value = true;

    // the tour's card holds focus by then, and the menu is not to take it back
    expect(closeMenu(wrapper)).toBe(true);
  });

  it("hands focus back as usual when it closes for anything else", () => {
    const wrapper = mountMenu();

    expect(closeMenu(wrapper)).toBe(false);
  });

  it("is the tour's stop for the profile", () => {
    const wrapper = mountMenu();

    expect(wrapper.find("[data-tour=profile]").exists()).toBe(true);
  });
});
