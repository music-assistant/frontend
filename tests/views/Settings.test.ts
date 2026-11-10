/**
 * The settings overview is where an admin runs the setup wizard again.
 */
import { UserRole } from "@/plugins/api/interfaces";
import Settings from "@/views/settings/Settings.vue";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authState, onboardingOpen } = vi.hoisted(() => ({
  authState: { role: "admin" as string },
  onboardingOpen: vi.fn(),
}));

vi.mock("@/plugins/api", () => {
  const apiMock = { providerManifests: {}, getProvider: vi.fn() };
  return { api: apiMock, default: apiMock };
});
vi.mock("@/plugins/api/helpers", () => ({
  requireServerVersion: () => true,
}));
vi.mock("@/plugins/auth", () => ({
  authManager: { isAdmin: () => authState.role === UserRole.ADMIN },
}));
vi.mock("@/composables/useOnboarding", () => ({
  useOnboarding: () => ({ open: onboardingOpen }),
}));
vi.mock("@/composables/userPreferences", async () => {
  const { ref } = await vi.importActual<typeof import("vue")>("vue");
  return {
    useUserPreferences: () => ({
      getPreference: () => ref(undefined),
      setPreference: vi.fn(),
    }),
  };
});
vi.mock("vue-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-router")>()),
  useRouter: () => ({
    currentRoute: { value: { name: "settings", params: {}, query: {} } },
    push: vi.fn(),
  }),
}));
vi.mock("vue-i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-i18n")>()),
  useI18n: () => ({ t: (key: string) => key }),
}));
vi.mock("vuetify", async (importOriginal) => {
  const { ref } = await vi.importActual<typeof import("vue")>("vue");
  return {
    ...(await importOriginal<typeof import("vuetify")>()),
    useDisplay: () => ({ mobile: ref(false) }),
  };
});

/** The settings overview, which is where onboarding is reachable again from. */
function mountOverview() {
  return mount(Settings, {
    global: {
      stubs: {
        // the container reaches for a Vuetify theme this bare mount does not
        // set up; what it wraps is what this is about
        Container: { template: "<div><slot /></div>" },
        Toolbar: { template: "<div />" },
        Icon: true,
        ListItem: true,
        RouterView: true,
        VBtn: true,
        VDivider: true,
        VList: true,
      },
    },
  });
}

describe("the link back into onboarding", () => {
  beforeEach(() => {
    onboardingOpen.mockReset();
  });

  it("offers an admin the setup wizard again", async () => {
    authState.role = UserRole.ADMIN;

    const wrapper = mountOverview();
    const link = wrapper.find("[data-testid=run-onboarding]");
    expect(link.text()).toBe("onboarding.run_again");

    await link.trigger("click");

    // the setup opens where it was left, or on whatever is left to set up
    expect(onboardingOpen).toHaveBeenCalledWith();

    wrapper.unmount();
  });

  it.each([UserRole.USER, UserRole.GUEST])(
    "offers a %s nothing: the setup is the admin's",
    (role) => {
      authState.role = role;

      const wrapper = mountOverview();

      expect(wrapper.find("[data-testid=run-onboarding]").exists()).toBe(false);

      wrapper.unmount();
    },
  );
});
