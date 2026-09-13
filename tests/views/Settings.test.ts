/**
 * The breadcrumb trail of the settings pages links only to the pages the role
 * of the user may open.
 */
import type { ToolbarHeadingItem } from "@/components/ToolbarHeading.vue";
import { UserRole, type Scope } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import Settings from "@/views/settings/Settings.vue";
import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BUILTIN_ROLE_SCOPES, scopeChecker } from "../fixtures/scopes";
import { user } from "../fixtures/user";

const { apiMock, hasScope, routeState } = vi.hoisted(() => ({
  apiMock: {
    players: { kitchen: { name: "Kitchen" } },
    providerManifests: {},
    getProvider: vi.fn(),
  },
  hasScope: vi.fn<(scope: Scope) => boolean>(),
  // which settings page is open: the overview is the one carrying the link
  // back into onboarding
  routeState: { name: "editplayeroptions" },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
vi.mock("@/plugins/auth", () => ({ authManager: { hasScope } }));
// the sections are covered where they are decided
vi.mock("@/helpers/settings_sections", () => ({
  availableSettingsSections: () => [],
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
    currentRoute: {
      value: {
        name: routeState.name,
        params: { playerId: "kitchen" },
        query: {},
      },
    },
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

const ToolbarHeadingStub = {
  props: ["title", "to", "items"],
  template: "<div />",
};

/**
 * The trail the settings page hands its heading on the options of a player.
 */
function playerOptionsTrail(): ToolbarHeadingItem[] {
  const wrapper = mount(Settings, {
    global: {
      stubs: {
        Toolbar: {
          template: '<div><slot name="title" /><slot name="append" /></div>',
        },
        ToolbarHeading: ToolbarHeadingStub,
        RouterView: true,
        VBtn: true,
        VDivider: true,
      },
    },
  });
  return wrapper.getComponent(ToolbarHeadingStub).props("items");
}

describe("Settings breadcrumbs on the options of a player", () => {
  it("link an admin to the players and to the settings of the player", () => {
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.admin));

    expect(playerOptionsTrail()).toEqual([
      {
        title: "settings.players",
        disabled: false,
        to: { name: "playersettings" },
      },
      {
        title: "Kitchen",
        disabled: false,
        to: { name: "editplayer", params: { playerId: "kitchen" } },
      },
      { title: "settings.category.options", disabled: true },
    ]);
  });

  it.each([
    ["a member", BUILTIN_ROLE_SCOPES.user],
    ["a guest", BUILTIN_ROLE_SCOPES.guest],
  ])(
    "are plain text for %s, who may only open the options",
    (_role, scopes) => {
      hasScope.mockImplementation(scopeChecker(scopes));

      const trail = playerOptionsTrail();

      expect(trail.map(({ title, disabled }) => ({ title, disabled }))).toEqual(
        [
          { title: "settings.players", disabled: false },
          { title: "Kitchen", disabled: false },
          { title: "settings.category.options", disabled: true },
        ],
      );
      expect(trail.filter((item) => item.to)).toEqual([]);
    },
  );
});

/** The settings overview, which is where onboarding is reachable again from. */
function mountOverview() {
  routeState.name = "settings";
  return mount(Settings, {
    global: {
      stubs: {
        // the container reaches for a Vuetify theme this bare mount does not
        // set up; what it wraps is what this is about
        Container: { template: "<div><slot /></div>" },
        Toolbar: { template: "<div />" },
        ToolbarHeading: ToolbarHeadingStub,
        RouterView: true,
        VBtn: true,
        VDivider: true,
      },
    },
  });
}

describe("the link back into onboarding", () => {
  afterEach(() => {
    routeState.name = "editplayeroptions";
    store.currentUser = undefined;
  });

  it("offers an admin the setup wizard again", () => {
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.admin));
    store.currentUser = user({ username: "admin", role: UserRole.ADMIN });

    const wrapper = mountOverview();

    expect(wrapper.find("[data-testid=run-onboarding]").text()).toBe(
      "onboarding.run_again",
    );

    wrapper.unmount();
  });

  it("offers a member the welcome, which is theirs to run again", () => {
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.user));
    store.currentUser = user({ username: "sam", role: UserRole.USER });

    const wrapper = mountOverview();

    // there is no setup for a member to run again, and the same route hands
    // them what onboarding is for them
    expect(wrapper.find("[data-testid=run-onboarding]").text()).toBe(
      "onboarding.welcome_again",
    );

    wrapper.unmount();
  });

  it("offers a guest nothing: onboarding has nothing for them", () => {
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.guest));
    store.currentUser = user({ username: "guest", role: UserRole.GUEST });

    const wrapper = mountOverview();

    expect(wrapper.find("[data-testid=run-onboarding]").exists()).toBe(false);

    wrapper.unmount();
  });
});
