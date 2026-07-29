import GuestLayout from "@/layouts/GuestLayout.vue";
import { mount } from "@vue/test-utils";
import { ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isGuestSession: { value: true },
  leaveGuestSession: vi.fn(),
  routeName: { value: "guest" },
  routerPush: vi.fn(),
  setGuestThemePreference: vi.fn(),
  store: {
    currentUser: {
      display_name: "Regular User",
      username: "regular-user",
    },
  },
}));

vi.mock("@/composables/guest/useGuestEntryResolver", () => ({
  guestEntryStateKey: Symbol("guest-entry-state"),
  useGuestEntryResolver: () => ({ state: ref("inactive") }),
}));

vi.mock("@/composables/useThemePreference", () => ({
  isThemePreference: (value: unknown) =>
    ["auto", "light", "dark"].includes(String(value)),
  THEME_PREFERENCES: ["auto", "light", "dark"],
  useThemePreference: () => ({
    themePreference: ref("auto"),
    setGuestThemePreference: mocks.setGuestThemePreference,
  }),
}));

vi.mock("@/plugins/auth", () => ({
  authManager: {
    isGuestAccessSession: () => mocks.isGuestSession.value,
    leaveGuestSession: mocks.leaveGuestSession,
  },
}));

vi.mock("@/plugins/store", () => ({
  store: mocks.store,
}));

vi.mock("vue-router", () => ({
  useRoute: () => ({
    get name() {
      return mocks.routeName.value;
    },
  }),
  useRouter: () => ({ push: mocks.routerPush }),
}));

vi.mock("vuetify", () => ({
  useTheme: () => ({
    current: ref({ dark: false }),
  }),
}));

const passthroughStub = { template: "<div><slot /></div>" };
const buttonStub = {
  template: '<button v-bind="$attrs"><slot /></button>',
};
const menuItemStub = {
  emits: ["click"],
  template: "<button @click=\"$emit('click')\"><slot /></button>",
};

function mountLayout() {
  return mount(GuestLayout, {
    global: {
      stubs: {
        Avatar: passthroughStub,
        AvatarFallback: passthroughStub,
        Button: buttonStub,
        DropdownMenu: passthroughStub,
        DropdownMenuContent: passthroughStub,
        DropdownMenuItem: menuItemStub,
        DropdownMenuLabel: passthroughStub,
        DropdownMenuRadioGroup: passthroughStub,
        DropdownMenuRadioItem: passthroughStub,
        DropdownMenuSeparator: true,
        DropdownMenuSub: passthroughStub,
        DropdownMenuSubContent: passthroughStub,
        DropdownMenuSubTrigger: passthroughStub,
        DropdownMenuTrigger: passthroughStub,
        MusicQuizHostControlsMenu: {
          emits: ["openHostPanel"],
          template:
            '<button data-testid="guest-host-controls" @click="$emit(\'openHostPanel\')" />',
        },
        RouterView: true,
      },
    },
  });
}

describe("GuestLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isGuestSession.value = true;
    mocks.routeName.value = "guest";
  });

  it("provides guest branding, appearance controls, and a safe exit", async () => {
    const wrapper = mountLayout();

    expect(wrapper.classes()).toContain("h-dvh");
    expect(wrapper.classes()).toContain("overflow-hidden");
    expect(wrapper.get("header").classes()).toContain("guest-layout-header");
    expect(
      wrapper.get('img[alt="Music Assistant"]').attributes("src"),
    ).toContain("logo-dark.svg");
    expect(wrapper.get("main").classes()).toContain("overflow-y-auto");
    expect(wrapper.text()).toContain("Guest access");
    expect(wrapper.text()).toContain("Theme");
    expect(wrapper.text()).toContain("Leave guest mode");

    const leaveButton = wrapper
      .findAll("button")
      .find((button) => button.text().includes("Leave guest mode"));
    await leaveButton?.trigger("click");

    expect(mocks.leaveGuestSession).toHaveBeenCalledOnce();
  });

  it("lets a regular user return from the guest dashboard", async () => {
    mocks.isGuestSession.value = false;
    const wrapper = mountLayout();

    expect(wrapper.text()).toContain("Regular User");
    expect(wrapper.text()).toContain("Back to Music Assistant");
    expect(wrapper.text()).not.toContain("Leave guest mode");

    const returnButton = wrapper
      .findAll("button")
      .find((button) => button.text().includes("Back to Music Assistant"));
    await returnButton?.trigger("click");

    expect(mocks.routerPush).toHaveBeenCalledWith({ name: "discover" });
  });

  it("lets a regular Quiz participant return to host controls", async () => {
    mocks.isGuestSession.value = false;
    mocks.routeName.value = "guest-quiz";
    const wrapper = mountLayout();

    await wrapper.get('[data-testid="guest-host-controls"]').trigger("click");

    expect(mocks.routerPush).toHaveBeenCalledWith({ name: "music-quiz" });
  });
});
