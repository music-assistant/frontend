/**
 * The breadcrumb trail of the settings pages links only to the pages the role
 * of the user may open.
 */
import SettingsOverview from "@/components/settings/SettingsOverview.vue";
import SettingsPageHeader from "@/components/settings/SettingsPageHeader.vue";
import SettingsViewModeToggle from "@/components/settings/SettingsViewModeToggle.vue";
import type { ToolbarHeadingItem } from "@/components/ToolbarHeading.vue";
import { useEditedProviderName } from "@/composables/useEditedProviderName";
import { useSettingsPageMenu } from "@/composables/useSettingsPageMenu";
import {
  ProviderOffering,
  ProviderType,
  UserRole,
  type ProviderManifest,
  Scope,
} from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import Settings from "@/views/settings/Settings.vue";
import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, type Component } from "vue";
import { BUILTIN_ROLE_SCOPES, scopeChecker } from "../fixtures/scopes";
import { user } from "../fixtures/user";

const { apiMock, hasScope, onboardingOpen, routerPush, routeState } =
  vi.hoisted(() => ({
    apiMock: {
      players: { kitchen: { name: "Kitchen" } },
      providerManifests: {} as Record<
        string,
        Pick<ProviderManifest, "name" | "type" | "provides">
      >,
      getProvider: vi.fn(),
      // resolves an instance id to a name, falling back to the manifest name
      // for the domain, the way the real client does
      getProviderName: vi.fn(
        (id: string) =>
          apiMock.providerManifests[id.split("--")[0]]?.name ?? id,
      ),
    },
    hasScope: vi.fn<(scope: Scope) => boolean>(),
    onboardingOpen: vi.fn(),
    routerPush: vi.fn(),
    // which settings page is open, and on what: the overview is the one carrying
    // the link back into onboarding
    routeState: {
      name: "editplayeroptions",
      params: { playerId: "kitchen" } as Record<string, string>,
      query: {} as Record<string, string>,
    },
  }));

// the source behind the instance id in the route, whose generic name the crumb
// shows until the page below it resolves the name of this instance
apiMock.providerManifests.spotify = {
  name: "Spotify",
  type: ProviderType.MUSIC,
  provides: [],
};

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
vi.mock("@/plugins/auth", () => ({ authManager: { hasScope } }));
vi.mock("@/composables/useOnboarding", () => ({
  useOnboarding: () => ({ open: onboardingOpen }),
}));
// the sections are covered where they are decided
vi.mock("@/helpers/settings_sections", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/helpers/settings_sections")>()),
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
        params: routeState.params,
        query: routeState.query,
      },
    },
    push: routerPush,
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

/**
 * The trail the settings page hands its heading on the settings of a provider,
 * with the page below it stubbed by `providerPage`.
 */
async function providerTrail(
  providerPage: Component | boolean,
  instanceId = "spotify--kitchen",
): Promise<ToolbarHeadingItem[]> {
  routeState.name = "editprovider";
  routeState.params = { instanceId };
  const wrapper = mount(Settings, {
    global: {
      stubs: {
        Toolbar: {
          template: '<div><slot name="title" /><slot name="append" /></div>',
        },
        ToolbarHeading: ToolbarHeadingStub,
        RouterView: providerPage,
        VBtn: true,
        VDivider: true,
      },
    },
  });
  // the page publishes its name as it mounts, which the trail picks up on the
  // render after
  await nextTick();
  const items = wrapper.getComponent(ToolbarHeadingStub).props("items");
  wrapper.unmount();
  return items;
}

describe("Settings breadcrumbs on the settings of a provider", () => {
  beforeEach(() => {
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.admin));
  });

  afterEach(() => {
    routeState.name = "editplayeroptions";
    routeState.params = { playerId: "kitchen" };
  });

  it("name the provider the way the page below them does", async () => {
    const trail = await providerTrail({
      setup() {
        useEditedProviderName().value = "The kitchen's Spotify";
      },
      template: "<div />",
    });

    expect(trail.at(-1)).toEqual({
      title: "The kitchen's Spotify",
      disabled: true,
    });
  });

  it("fall back on the name of the source until the page names the instance", async () => {
    const trail = await providerTrail(true);

    expect(trail.at(-1)).toEqual({ title: "Spotify", disabled: true });
  });
});

describe("Settings breadcrumbs on the Music pages", () => {
  const MUSIC = {
    title: "settings.music",
    disabled: false,
    to: { name: "musicsettings" },
  };
  const METADATA = {
    title: "metadata",
    disabled: false,
    to: { name: "metadataproviders" },
  };
  const AUDIO_ANALYSIS = {
    title: "settings.audio_analysis_providers",
    disabled: false,
    to: { name: "audioanalysisproviders" },
  };

  beforeEach(() => {
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.admin));
  });

  afterEach(() => {
    routeState.name = "editplayeroptions";
    routeState.params = { playerId: "kitchen" };
    routeState.query = {};
  });

  it("name Music as the page on screen on the music sources", () => {
    expect(pageTrail("musicsettings")).toEqual([
      { title: MUSIC.title, disabled: true },
    ]);
  });

  it.each([
    ["librarysettings", "settings.library.title"],
    ["genremanagement", "settings.genre_management"],
  ])("hang %s under Music", (name, title) => {
    expect(pageTrail(name)).toEqual([MUSIC, { title, disabled: true }]);
  });

  it.each([
    ["metadataproviders", METADATA.title],
    ["audioanalysisproviders", AUDIO_ANALYSIS.title],
  ])("hang the %s list under Music", (name, title) => {
    expect(pageTrail(name)).toEqual([MUSIC, { title, disabled: true }]);
  });
});

/** The trail the settings page hands its heading on the given page. */
function pageTrail(
  name: string,
  params: Record<string, string> = {},
  query: Record<string, string> = {},
): ToolbarHeadingItem[] {
  routeState.name = name;
  routeState.params = params;
  routeState.query = query;
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
  const items = wrapper.getComponent(ToolbarHeadingStub).props("items");
  wrapper.unmount();
  return items;
}

describe("Settings breadcrumbs on the System pages", () => {
  const SYSTEM = {
    title: "settings.system",
    disabled: false,
    to: { name: "systemsettings" },
  };

  beforeEach(() => {
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.admin));
  });

  afterEach(() => {
    routeState.name = "editplayeroptions";
    routeState.params = { playerId: "kitchen" };
    delete apiMock.providerManifests.radio_tuner;
  });

  it("hang the task settings under the background tasks", () => {
    expect(pageTrail("tasksettings")).toEqual([
      SYSTEM,
      {
        title: "background_tasks.title",
        disabled: false,
        to: { name: "backgroundtasks" },
      },
      { title: "background_tasks.settings.title", disabled: true },
    ]);
  });

  it("hang the storage under the System settings", () => {
    expect(pageTrail("storagesettings")).toEqual([
      SYSTEM,
      { title: "settings.storage.title", disabled: true },
    ]);
  });

  it("hang the diagnostics under the System settings", () => {
    expect(pageTrail("diagnostics")).toEqual([
      SYSTEM,
      { title: "settings.diagnostics", disabled: true },
    ]);
  });

  it("name a module no settings page shows by its manifest, below the System settings", () => {
    apiMock.providerManifests.radio_tuner = {
      name: "Radio tuner",
      // the manifest of a core module has a type the provider types leave out
      type: "core" as ProviderType,
      provides: [],
    };

    expect(pageTrail("editcore", { domain: "radio_tuner" })).toEqual([
      SYSTEM,
      { title: "Radio tuner", disabled: true },
    ]);
  });
});

describe("Settings breadcrumbs on a section of the overview", () => {
  beforeEach(() => {
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.admin));
  });

  afterEach(() => {
    routeState.name = "editplayeroptions";
    routeState.params = { playerId: "kitchen" };
  });

  it.each([
    ["catalog", "settings.catalog.title"],
    ["pluginproviders", "settings.plugins"],
    ["playersettings", "settings.players"],
    ["usersettings", "auth.user_management"],
    ["systemsettings", "settings.system"],
    ["aboutsettings", "settings.about"],
  ])("name %s as the page on screen", (name, title) => {
    expect(pageTrail(name)).toEqual([{ title, disabled: true }]);
  });

  it("name the System settings as plain text above the tasks for who may only read them", () => {
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.user));

    expect(pageTrail("backgroundtasks")).toEqual([
      { title: "settings.system", disabled: false, to: undefined },
      { title: "background_tasks.title", disabled: true },
    ]);
  });
});

describe("Settings breadcrumbs on the network pages", () => {
  beforeEach(() => {
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.admin));
  });

  afterEach(() => {
    routeState.name = "editplayeroptions";
    routeState.params = { playerId: "kitchen" };
  });

  it("hang the network page under the System settings", () => {
    expect(pageTrail("networksettings")).toEqual([
      {
        title: "settings.system",
        disabled: false,
        to: { name: "systemsettings" },
      },
      { title: "settings.network.title", disabled: true },
    ]);
  });

  it("hang remote access under the network page", () => {
    expect(pageTrail("remoteaccesssettings")).toEqual([
      {
        title: "settings.system",
        disabled: false,
        to: { name: "systemsettings" },
      },
      {
        title: "settings.network.title",
        disabled: false,
        to: { name: "networksettings" },
      },
      { title: "settings.remote_access", disabled: true },
    ]);
  });
});

describe("Settings breadcrumbs on the Home Assistant pages", () => {
  const SYSTEM = {
    title: "settings.system",
    disabled: false,
    to: { name: "systemsettings" },
  };

  beforeEach(() => {
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.admin));
    apiMock.getProvider.mockReturnValue(undefined);
    apiMock.providerManifests.hass = {
      name: "Home Assistant",
      type: ProviderType.PLUGIN,
      provides: [],
    };
  });

  afterEach(() => {
    routeState.name = "editplayeroptions";
    routeState.params = { playerId: "kitchen" };
    delete apiMock.providerManifests.hass;
  });

  it("hang the Home Assistant page under the System settings", () => {
    expect(pageTrail("homeassistantsettings")).toEqual([
      SYSTEM,
      { title: "settings.home_assistant.title", disabled: true },
    ]);
  });

  it("hang the settings of the Home Assistant provider under its page", async () => {
    expect(await providerTrail(true, "hass")).toEqual([
      SYSTEM,
      {
        title: "settings.home_assistant.title",
        disabled: false,
        to: { name: "homeassistantsettings" },
      },
      { title: "Home Assistant", disabled: true },
    ]);
  });
});

describe("Settings breadcrumbs on the pages below the players", () => {
  const players = {
    title: "settings.players",
    disabled: false,
    to: { name: "playersettings" },
  };

  beforeEach(() => {
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.admin));
  });

  afterEach(() => {
    routeState.name = "editplayeroptions";
    routeState.params = { playerId: "kitchen" };
    routeState.query = {};
    delete apiMock.providerManifests.sonos;
  });

  it("hang the playback defaults under the players", () => {
    expect(pageTrail("playbacksettings")).toEqual([
      players,
      { title: "settings.playback.title", disabled: true },
    ]);
  });

  it("hang the player providers under the players", () => {
    expect(pageTrail("playerproviders")).toEqual([
      players,
      { title: "settings.playerproviders", disabled: true },
    ]);
  });

  it("hang adding a group player under the players", () => {
    expect(pageTrail("addgroup", { provider: "sonos--kitchen" })).toEqual([
      players,
      { title: "settings.add_group_player", disabled: true },
    ]);
  });

  it("hang the settings of a player provider under the player providers", async () => {
    apiMock.getProvider.mockReturnValue(undefined);
    apiMock.providerManifests.sonos = {
      name: "Sonos",
      type: ProviderType.PLAYER,
      provides: [],
    };

    expect(await providerTrail(true, "sonos--kitchen")).toEqual([
      players,
      {
        title: "settings.playerproviders",
        disabled: false,
        to: { name: "playerproviders" },
      },
      { title: "Sonos", disabled: true },
    ]);
  });
});

describe("Settings breadcrumbs on the profile pages", () => {
  beforeEach(() => {
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.guest));
  });

  afterEach(() => {
    routeState.name = "editplayeroptions";
    routeState.params = { playerId: "kitchen" };
  });

  it("name the profile on its own page", () => {
    expect(pageTrail("profile")).toEqual([
      { title: "auth.profile", disabled: true },
    ]);
  });

  it.each([
    ["profileinterface", "auth.profile_pages.interface"],
    ["profiledevice", "auth.profile_pages.device"],
    ["profilesecurity", "auth.profile_pages.security"],
  ])("hang %s under the profile", (name, title) => {
    expect(pageTrail(name)).toEqual([
      { title: "auth.profile", disabled: false, to: { name: "profile" } },
      { title, disabled: true },
    ]);
  });
});

describe("Settings breadcrumbs on the settings of a provider that is not loaded", () => {
  beforeEach(() => {
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.admin));
    apiMock.getProvider.mockReturnValue(undefined);
  });

  afterEach(() => {
    routeState.name = "editplayeroptions";
    routeState.params = { playerId: "kitchen" };
    delete apiMock.providerManifests.fanarttv;
    delete apiMock.providerManifests.filesystem_local;
    delete apiMock.providerManifests.essentia;
    delete apiMock.providerManifests.airplay_receiver;
    delete apiMock.providerManifests.lastfm;
  });

  it("lead to the providers of the type of its provider, below Music", async () => {
    apiMock.providerManifests.fanarttv = {
      name: "fanart.tv",
      type: ProviderType.METADATA,
      provides: [],
    };

    expect(await providerTrail(true, "fanarttv--kitchen")).toEqual([
      {
        title: "settings.music",
        disabled: false,
        to: { name: "musicsettings" },
      },
      {
        title: "metadata",
        disabled: false,
        to: { name: "metadataproviders" },
      },
      { title: "fanart.tv", disabled: true },
    ]);
  });

  it("lead an audio analysis provider to its providers, below Music", async () => {
    apiMock.providerManifests.essentia = {
      name: "Essentia",
      type: ProviderType.AUDIO_ANALYSIS,
      provides: [],
    };

    const trail = await providerTrail(true, "essentia--kitchen");

    expect(trail.map(({ title }) => title)).toEqual([
      "settings.music",
      "settings.audio_analysis_providers",
      "Essentia",
    ]);
  });

  it("lead a plugin offering audio sources to Music, where it is listed", async () => {
    apiMock.providerManifests.airplay_receiver = {
      name: "AirPlay Receiver",
      type: ProviderType.PLUGIN,
      provides: [ProviderOffering.AUDIO_SOURCE],
    };

    const trail = await providerTrail(true, "airplay_receiver--kitchen");

    expect(trail).toEqual([
      {
        title: "settings.music",
        disabled: false,
        to: { name: "musicsettings" },
      },
      { title: "AirPlay Receiver", disabled: true },
    ]);
  });

  it("lead any other plugin to the plugins", async () => {
    apiMock.providerManifests.lastfm = {
      name: "Last.fm",
      type: ProviderType.PLUGIN,
      provides: [],
    };

    expect(await providerTrail(true, "lastfm--kitchen")).toEqual([
      {
        title: "settings.plugins",
        disabled: false,
        to: { name: "pluginproviders" },
      },
      { title: "Last.fm", disabled: true },
    ]);
  });

  // the server converts SMB and NFS sources into Local files, keeping their ids
  it("lead a converted source to the music sources, by Local files", async () => {
    apiMock.providerManifests.filesystem_local = {
      name: "Local files",
      type: ProviderType.MUSIC,
      provides: [],
    };

    const trail = await providerTrail(true, "filesystem_nfs--k2Lm9xQa");

    expect(trail[0].title).toBe("settings.music");
  });
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
  beforeEach(() => {
    routerPush.mockReset();
    onboardingOpen.mockReset();
  });

  afterEach(() => {
    routeState.name = "editplayeroptions";
    store.currentUser = undefined;
  });

  it("opens the admin setup wizard again at the setup choice", async () => {
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.admin));
    store.currentUser = user({ username: "admin", role: UserRole.ADMIN });

    const wrapper = mountOverview();
    const link = wrapper.find("[data-testid=run-onboarding]");
    expect(link.text()).toBe("onboarding.run_again");

    await link.trigger("click");

    expect(onboardingOpen).toHaveBeenCalledWith("intent");

    wrapper.unmount();
  });

  it("offers a member the welcome, which is theirs to run again", async () => {
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.user));
    store.currentUser = user({ username: "sam", role: UserRole.USER });

    const wrapper = mountOverview();
    const link = wrapper.find("[data-testid=run-onboarding]");

    // there is no setup for a member to run again, and the same route hands
    // them what onboarding is for them
    expect(link.text()).toBe("onboarding.welcome_again");

    await link.trigger("click");

    // showing the welcome again means showing it from the top: by the time
    // this link is any use, nothing on it is left to do
    expect(onboardingOpen).toHaveBeenCalledWith("welcome");

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

describe("the toolbar's view mode toggle", () => {
  afterEach(() => {
    routeState.name = "editplayeroptions";
  });

  function toolbarToggle(routeName: string) {
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.admin));
    routeState.name = routeName;
    const wrapper = mount(Settings, {
      global: {
        stubs: {
          Toolbar: { template: '<div><slot name="append" /></div>' },
          ToolbarHeading: ToolbarHeadingStub,
          RouterView: true,
          VBtn: true,
          VDivider: true,
        },
      },
    });
    const shows = wrapper.findComponent(SettingsViewModeToggle).exists();
    wrapper.unmount();
    return shows;
  }

  it("switches the view of the overview", () => {
    expect(toolbarToggle("settings")).toBe(true);
  });

  it.each(["backgroundtasks", "playersettings"])(
    "leaves the view of the list on %s to the header of that list",
    (routeName) => {
      expect(toolbarToggle(routeName)).toBe(false);
    },
  );
});

describe("Settings page menu", () => {
  afterEach(() => {
    routeState.name = "editplayeroptions";
  });

  it("hands what the page below it publishes to the header of that page, not to the toolbar", async () => {
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.admin));
    routeState.name = "playersettings";
    const ToolbarStub = {
      props: ["menuItems", "enforceOverflowMenu", "menuActive"],
      template: '<div><slot name="title" /><slot name="append" /></div>',
    };
    const OverflowMenuStub = {
      name: "OverflowMenu",
      props: ["items"],
      template: "<div><slot /></div>",
    };
    const page = defineComponent({
      setup() {
        useSettingsPageMenu().value = [
          { label: "settings.hide_unavailable_players", active: true },
        ];
        return () => h(SettingsPageHeader, { page: "players" });
      },
    });
    const wrapper = mount(Settings, {
      global: {
        stubs: {
          OverflowMenu: OverflowMenuStub,
          Toolbar: ToolbarStub,
          ToolbarHeading: ToolbarHeadingStub,
          RouterView: page,
          VBtn: true,
          VDivider: true,
        },
      },
    });
    await nextTick();

    expect(
      wrapper.getComponent(ToolbarStub).props("menuItems"),
    ).toBeUndefined();
    expect(wrapper.getComponent(OverflowMenuStub).props("items")).toEqual([
      { label: "settings.hide_unavailable_players", active: true },
    ]);
    // an option that is on shows on the menu button
    expect(
      wrapper.find('[data-testid="settings-page-menu-active"]').exists(),
    ).toBe(true);

    wrapper.unmount();
  });
});

describe("the settings column", () => {
  afterEach(() => {
    routeState.name = "editplayeroptions";
  });

  it("holds the overview", () => {
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.admin));

    const wrapper = mountOverview();

    expect(
      wrapper
        .get("[data-testid=settings-column]")
        .findComponent(SettingsOverview)
        .exists(),
    ).toBe(true);

    wrapper.unmount();
  });

  it("holds the page on screen, while the toolbar spans the whole width", () => {
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.admin));
    routeState.name = "playersettings";

    const wrapper = mount(Settings, {
      global: {
        stubs: {
          Toolbar: { template: '<header data-testid="toolbar" />' },
          ToolbarHeading: ToolbarHeadingStub,
          RouterView: { template: '<main data-testid="page" />' },
          VBtn: true,
          VDivider: true,
        },
      },
    });
    const column = wrapper.get("[data-testid=settings-column]");

    expect(column.find("[data-testid=page]").exists()).toBe(true);
    expect(wrapper.find("[data-testid=toolbar]").exists()).toBe(true);
    expect(column.find("[data-testid=toolbar]").exists()).toBe(false);

    wrapper.unmount();
  });
});
