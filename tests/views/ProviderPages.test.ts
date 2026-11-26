/**
 * The settings pages listing providers: the Music hub, the metadata and the
 * audio analysis pages, and the page listing the providers of each other type.
 */
import {
  flushPromises,
  type MountingOptions,
  shallowMount,
} from "@vue/test-utils";
import { type Component, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CommunityProviderState,
  type CoreConfig,
  ProviderOffering,
  type ProviderConfig,
  ProviderFeature,
  type ProviderInstance,
  ProviderSharing,
  ProviderStage,
  ProviderStatus,
  ProviderTier,
  ProviderType,
  Scope,
  type User,
  UserRole,
  SharedPlayback,
} from "@/plugins/api/interfaces";
import type { MusicAssistantApi } from "@/plugins/api";
import CommunityMovedNotice from "@/components/settings/catalog/CommunityMovedNotice.vue";
import SettingsListPanel from "@/components/settings/SettingsListPanel.vue";
import AudioAnalysis from "@/views/settings/AudioAnalysis.vue";
import MetadataSettings from "@/views/settings/MetadataSettings.vue";
import MusicSettings from "@/views/settings/MusicSettings.vue";
import ProviderListSettings from "@/views/settings/ProviderListSettings.vue";
import { communityProvider } from "../fixtures/communityProvider";
import { providerConfig } from "../fixtures/providerConfig";
import { providerInstance } from "../fixtures/providerInstance";
import { providerManifest } from "../fixtures/providerManifest";
import {
  BUILTIN_ROLE_SCOPES,
  MEMBER_WITHOUT_OWN_SCOPES,
  OWN_SOURCES_ROLE_SCOPES,
  scopeChecker,
} from "../fixtures/scopes";
import { user, userSummary } from "../fixtures/user";

const {
  apiMock,
  authMock,
  eventbusMock,
  i18nMock,
  routerMock,
  storeMock,
  toastMock,
} = vi.hoisted(() => ({
  apiMock: {
    dismissCommunityNotice:
      vi.fn<MusicAssistantApi["dismissCommunityNotice"]>(),
    getAllUsers: vi.fn<MusicAssistantApi["getAllUsers"]>(),
    getCommunityProviders: vi.fn<MusicAssistantApi["getCommunityProviders"]>(),
    getCoreConfig: vi.fn<MusicAssistantApi["getCoreConfig"]>(),
    getProvider: vi.fn<MusicAssistantApi["getProvider"]>(),
    getProviderConfigs: vi.fn<MusicAssistantApi["getProviderConfigs"]>(),
    getShareCandidates: vi.fn<MusicAssistantApi["getShareCandidates"]>(),
    providerManifests: {
      spotify: {
        allow_disable: true,
        builtin: false,
        description: "Spotify music provider",
        documentation: "https://example.com",
        has_setup_flow: true,
        name: "Spotify",
        provides: [] as string[],
        self_service: true,
        stage: "stable",
        tier: "core",
        type: "music",
      },
      builtin: {
        allow_disable: false,
        builtin: true,
        description: "Music Assistant's builtin library",
        documentation: "https://example.com",
        has_setup_flow: false,
        name: "Music Assistant",
        self_service: false,
        stage: "stable",
      },
    },
    providers: {} as Record<string, ProviderInstance>,
    reloadProvider: vi.fn<MusicAssistantApi["reloadProvider"]>(),
    removeProviderConfig: vi.fn<MusicAssistantApi["removeProviderConfig"]>(),
    saveProviderConfig: vi.fn<MusicAssistantApi["saveProviderConfig"]>(),
    startSync: vi.fn<MusicAssistantApi["startSync"]>(),
    subscribe: vi.fn(),
  },
  authMock: {
    hasScope: vi.fn<(scope: Scope) => boolean>(),
  },
  eventbusMock: {
    emit: vi.fn(),
  },
  // a spy that returns the key, so the interpolation arguments a message is
  // given stay assertable
  i18nMock: {
    $t: vi.fn((key: string) => key),
  },
  routerMock: {
    push: vi.fn(),
  },
  storeMock: {
    currentUser: undefined as User | undefined,
  },
  toastMock: {
    error: vi.fn(),
  },
}));

const owner = user({
  display_name: "Marcel",
  user_id: "user-marcel",
  username: "marcel",
});

const member = user({ user_id: "user-sam", username: "sam" });

// the share candidates the server lists: every enabled member, the owner included
const shareCandidates = [
  userSummary({
    display_name: "Marcel",
    user_id: "user-marcel",
    username: "marcel",
  }),
  userSummary({ user_id: "user-sam", username: "sam" }),
];

vi.mock("@/plugins/api", () => ({
  api: apiMock,
  default: apiMock,
}));

vi.mock("@/plugins/auth", () => ({
  authManager: authMock,
}));

vi.mock("@/plugins/store", () => ({
  store: storeMock,
}));

vi.mock("@/plugins/eventbus", () => ({
  eventbus: eventbusMock,
}));

vi.mock("@/plugins/i18n", () => i18nMock);

vi.mock("@/plugins/router", () => ({
  default: routerMock,
}));

vi.mock("@/composables/background-tasks/useBackgroundTasks", () => ({
  useBackgroundTasks: () => ({
    isProviderSyncing: () => false,
  }),
}));

vi.mock("@/helpers/utils", () => ({
  openLinkInNewTab: vi.fn(),
}));

// rendered in place of the real dialog, exposing what it was handed
const AccessDialogStub = vi.hoisted(() => ({
  name: "ProviderAccessDialog",
  props: ["canChangeOwner", "config", "open", "shareCandidates", "users"],
  template: `
    <div
      data-testid="access-dialog"
      :data-open="String(open)"
      :data-config="config?.instance_id ?? ''"
      :data-users="users === null ? 'none' : String(users.length)"
      :data-share-candidates="
        shareCandidates === null
          ? 'none'
          : shareCandidates.map((candidate) => candidate.user_id).join(',')
      "
      :data-can-change-owner="String(canChangeOwner)"
    />
  `,
}));

vi.mock("@/components/settings/providers/ProviderAccessDialog.vue", () => ({
  default: AccessDialogStub,
}));

vi.mock("vue-sonner", () => ({
  toast: toastMock,
}));

vi.mock("vue-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("vue-router")>();
  return {
    ...actual,
    useRouter: () => routerMock,
  };
});

const SlotStub = {
  template: "<div><slot /></div>",
};

const ButtonStub = {
  emits: ["click"],
  template: `<button @click="$emit('click', $event)"><slot /></button>`,
};

// stands in for the extracted row so the view's tests can read the flags it is
// handed and drive the events it emits, without depending on how it renders
const ProviderRowStub = {
  name: "ProviderRow",
  props: [
    "config",
    "variant",
    "columns",
    "manageable",
    "reconfigurable",
    "syncing",
    "name",
    "description",
    "accessSummary",
    "statusVariant",
    "statusIcon",
    "statusLabel",
    "isError",
    "errorText",
    "community",
    "removable",
    "labels",
  ],
  emits: ["open", "menu", "reconfigure", "remove"],
  template: `<div data-testid="provider-row">{{ name }}</div>`,
};

// a console spy has to be let go even when its test fails
afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.clearAllMocks();
  apiMock.getAllUsers.mockResolvedValue([owner, member]);
  apiMock.getCommunityProviders.mockResolvedValue([]);
  apiMock.getCoreConfig.mockResolvedValue({
    values: {},
  } as unknown as CoreConfig);
  apiMock.getProvider.mockReturnValue(undefined);
  apiMock.getShareCandidates.mockResolvedValue(shareCandidates);
  apiMock.providers = {};
  apiMock.providerManifests.spotify.builtin = false;
  apiMock.providerManifests.spotify.has_setup_flow = true;
  apiMock.providerManifests.spotify.self_service = true;
  apiMock.providerManifests.spotify.stage = ProviderStage.STABLE;
  apiMock.providerManifests.spotify.tier = ProviderTier.CORE;
  apiMock.reloadProvider.mockResolvedValue(undefined);
  apiMock.subscribe.mockReturnValue(vi.fn());
  authMock.hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.admin));
  pageType = ProviderType.MUSIC;
  storeMock.currentUser = owner;
});

// the providers of the page a test opens: the Music hub for the music sources,
// the page of its own for any other type
let pageType: ProviderType = ProviderType.MUSIC;

describe("Providers", () => {
  it("opens reconfiguration when an authentication-required provider is activated", async () => {
    const wrapper = await mountProviders(ProviderStatus.AUTH_REQUIRED);

    onlyRow(wrapper).vm.$emit("open");

    expect(eventbusMock.emit).toHaveBeenCalledWith("setupFlowDialog", {
      kind: "reconfigure",
      instanceId: "spotify--test",
      name: "Spotify",
      onFlowEnded: expect.any(Function),
    });
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it("opens options when a provider with a generic error is activated", async () => {
    const wrapper = await mountProviders(ProviderStatus.ERROR);

    onlyRow(wrapper).vm.$emit("open");

    expect(routerMock.push).toHaveBeenCalledWith(
      "/settings/editprovider/spotify--test",
    );
    expect(eventbusMock.emit).not.toHaveBeenCalledWith(
      "setupFlowDialog",
      expect.anything(),
    );
  });

  it("hands the row no reconfigure action when there is no setup flow", async () => {
    const wrapper = await mountProviders(ProviderStatus.AUTH_REQUIRED, false);

    onlyRow(wrapper).vm.$emit("open");

    expect(routerMock.push).toHaveBeenCalledWith(
      "/settings/editprovider/spotify--test",
    );
    expect(onlyRow(wrapper).props("reconfigurable")).toBe(false);
  });

  it("starts reconfiguration from the provider warning action", async () => {
    const wrapper = await mountProviders(ProviderStatus.ERROR);

    onlyRow(wrapper).vm.$emit("reconfigure");

    expect(eventbusMock.emit).toHaveBeenCalledWith("setupFlowDialog", {
      kind: "reconfigure",
      instanceId: "spotify--test",
      name: "Spotify",
      onFlowEnded: expect.any(Function),
    });
    expect(routerMock.push).not.toHaveBeenCalled();

    const setupFlowCall = eventbusMock.emit.mock.calls.find(
      ([event]) => event === "setupFlowDialog",
    );
    setupFlowCall?.[1].onFlowEnded(true);
    await flushPromises();
    expect(apiMock.getProviderConfigs).toHaveBeenCalledTimes(2);
  });

  it("offers separate reconfigure and options menu actions", async () => {
    const wrapper = await mountProviders(ProviderStatus.LOADED);

    const menuItems = await openMenu(wrapper);

    expect(
      menuItems.slice(0, 2).map((item: { label: string }) => item.label),
    ).toEqual(["settings.reconfigure", "settings.options"]);

    menuItems[0].action();
    expect(eventbusMock.emit).toHaveBeenCalledWith("setupFlowDialog", {
      kind: "reconfigure",
      instanceId: "spotify--test",
      name: "Spotify",
      onFlowEnded: expect.any(Function),
    });

    menuItems[1].action();
    expect(routerMock.push).toHaveBeenCalledWith(
      "/settings/editprovider/spotify--test",
    );
  });

  it("reloads a provider through the shared API action", async () => {
    const wrapper = await mountProviders(ProviderStatus.LOADED);

    const menuItems = await openMenu(wrapper);
    const reloadItem = menuItems.find(
      (item: { label: string }) => item.label === "settings.reload",
    );
    reloadItem.action();

    expect(apiMock.reloadProvider).toHaveBeenCalledWith("spotify--test");
  });

  it.each([
    ["pointer", { clientX: 5, clientY: 7 }, 5, 7],
    [
      "touch position of a long-press",
      { touches: [{ clientX: 11, clientY: 22 }], changedTouches: [] },
      11,
      22,
    ],
  ])("opens the menu at the %s", async (_label, event, posX, posY) => {
    const wrapper = await mountProviders(ProviderStatus.LOADED);

    onlyRow(wrapper).vm.$emit("menu", event);
    await flushPromises();

    expect(eventbusMock.emit).toHaveBeenCalledWith("contextmenu", {
      items: expect.any(Array),
      posX,
      posY,
    });
  });

  it("opens no menu while the provider manifest has not loaded yet", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const wrapper = await mountProviders(ProviderStatus.LOADED, true, true, {
      domain: "not_loaded",
    });

    onlyRow(wrapper).vm.$emit("menu", { clientX: 5, clientY: 7 });
    await flushPromises();

    expect(warnSpy).toHaveBeenCalled();
    expect(eventbusMock.emit).not.toHaveBeenCalledWith(
      "contextmenu",
      expect.anything(),
    );
  });

  it("asks for confirmation before removing a provider from the row menu", async () => {
    // removing a source cannot be undone, so the row menu has to confirm it
    // just like the provider detail page does
    apiMock.removeProviderConfig.mockResolvedValue(undefined);
    // a renamed source must be confirmed under the name the user gave it,
    // so the custom name has to win over the manifest's "Spotify"
    const wrapper = await mountProviders(ProviderStatus.LOADED, true, true, {
      name: "My Spotify",
    });

    const menuItems = await openMenu(wrapper);
    menuItems
      .find(
        (item: { label: string }) => item.label === "settings.remove_provider",
      )
      .action();

    const removeCall = eventbusMock.emit.mock.calls.find(
      ([event]) => event === "deleteConfirmationDialog",
    );
    expect(removeCall?.[1].message).toBe(
      "settings.remove_provider_confirm_music",
    );
    // the stubbed $t returns the key, so the name is checked where it is passed
    expect(i18nMock.$t).toHaveBeenCalledWith(
      "settings.remove_provider_confirm_music",
      ["My Spotify"],
    );
    expect(apiMock.removeProviderConfig).not.toHaveBeenCalled();

    await removeCall?.[1].onConfirm();
    await flushPromises();

    expect(apiMock.removeProviderConfig).toHaveBeenCalledWith("spotify--test");
    expect(wrapper.findAllComponents(ProviderRowStub)).toHaveLength(0);
  });

  it("keeps the provider listed when removing it fails", async () => {
    // the server still has the source, so the list must not pretend otherwise
    apiMock.removeProviderConfig.mockRejectedValue(new Error("nope"));
    const wrapper = await mountProviders(ProviderStatus.LOADED);

    const menuItems = await openMenu(wrapper);
    menuItems
      .find(
        (item: { label: string }) => item.label === "settings.remove_provider",
      )
      .action();

    const removeCall = eventbusMock.emit.mock.calls.find(
      ([event]) => event === "deleteConfirmationDialog",
    );
    await removeCall?.[1].onConfirm();
    await flushPromises();

    expect(toastMock.error).toHaveBeenCalledWith("Error: nope");
    expect(wrapper.findAllComponents(ProviderRowStub)).toHaveLength(1);
  });

  it("shows the previous state again when toggling a provider fails", async () => {
    apiMock.saveProviderConfig.mockRejectedValue(new Error("nope"));
    const wrapper = await mountProviders(ProviderStatus.LOADED);

    const toggle = async () => {
      eventbusMock.emit.mockClear();
      return (await openMenu(wrapper)).find((item: { label: string }) =>
        ["settings.disable", "settings.enable"].includes(item.label),
      );
    };
    (await toggle()).action();
    await flushPromises();

    // the api toasts a refused save itself
    expect(toastMock.error).not.toHaveBeenCalled();
    expect((await toggle()).label).toBe("settings.disable");
  });

  it("omits reconfigure from the menu when no setup flow exists", async () => {
    const wrapper = await mountProviders(ProviderStatus.LOADED, false);

    const menuItems = await openMenu(wrapper);

    expect(
      menuItems.map((item: { label: string }) => item.label),
    ).not.toContain("settings.reconfigure");
    expect(menuItems[0].label).toBe("settings.options");
  });

  it("omits reconfigure for disabled providers", async () => {
    const wrapper = await mountProviders(ProviderStatus.DISABLED, true, false);

    const menuItems = await openMenu(wrapper);

    expect(
      menuItems.map((item: { label: string }) => item.label),
    ).not.toContain("settings.reconfigure");
    expect(menuItems[0].label).toBe("settings.options");
  });

  it("omits reconfigure for incompatible providers", async () => {
    const wrapper = await mountProviders(ProviderStatus.INCOMPATIBLE);

    const menuItems = await openMenu(wrapper);

    expect(
      menuItems.map((item: { label: string }) => item.label),
    ).not.toContain("settings.reconfigure");
  });

  it("marks a community provider", async () => {
    apiMock.providerManifests.spotify.tier = ProviderTier.COMMUNITY;

    const wrapper = await mountProviders(ProviderStatus.LOADED);

    expect(onlyRow(wrapper).props("community")).toBe(true);
  });

  it("leaves a core provider unmarked", async () => {
    const wrapper = await mountProviders(ProviderStatus.LOADED);

    expect(onlyRow(wrapper).props("community")).toBe(false);
  });

  it("summarizes a music source without an access record as a household one", async () => {
    const wrapper = await mountProviders(ProviderStatus.LOADED);

    expect(onlyRow(wrapper).props("accessSummary")).toBe(
      "settings.source_access.household · settings.source_access.options.everyone",
    );
  });

  it("summarizes a music source shared with selected members", async () => {
    const wrapper = await mountProviders(ProviderStatus.LOADED, true, true, {
      access: {
        owner: "user-marcel",
        shared_users: ["user-sam"],
        shared_playback: SharedPlayback.WITHOUT_OWN,
        sharing: ProviderSharing.SELECTED,
      },
    });

    expect(onlyRow(wrapper).props("accessSummary")).toBe(
      "Marcel · settings.source_access.shared_with_count",
    );
  });

  it("summarizes a music source without an owner shared with selected members", async () => {
    const wrapper = await mountProviders(ProviderStatus.LOADED, true, true, {
      access: {
        owner: null,
        shared_users: ["user-sam"],
        shared_playback: SharedPlayback.WITHOUT_OWN,
        sharing: ProviderSharing.SELECTED,
      },
    });

    expect(onlyRow(wrapper).props("accessSummary")).toBe(
      "settings.source_access.household · settings.source_access.shared_with_count",
    );
  });

  it.each([
    ["private", ProviderSharing.PRIVATE],
    ["shared with nobody selected", ProviderSharing.SELECTED],
  ])(
    "says nobody can use a music source without an owner that is %s",
    async (_label, sharing) => {
      const wrapper = await mountProviders(ProviderStatus.LOADED, true, true, {
        access: {
          owner: null,
          shared_users: [],
          sharing,
          shared_playback: SharedPlayback.WITHOUT_OWN,
        },
      });

      expect(onlyRow(wrapper).props("accessSummary")).toBe(
        "settings.source_access.nobody",
      );
    },
  );

  it("falls back to the raw id of an owner that is not a known user", async () => {
    const wrapper = await mountProviders(ProviderStatus.LOADED, true, true, {
      access: {
        owner: "user-gone",
        shared_users: [],
        shared_playback: SharedPlayback.WITHOUT_OWN,
        sharing: ProviderSharing.PRIVATE,
      },
    });

    expect(onlyRow(wrapper).props("accessSummary")).toBe(
      "user-gone · settings.source_access.options.not_shared",
    );
  });

  it("names the viewing admin's own private source as only theirs", async () => {
    const wrapper = await mountProviders(ProviderStatus.LOADED, true, true, {
      access: {
        owner: "user-marcel",
        shared_users: [],
        shared_playback: SharedPlayback.WITHOUT_OWN,
        sharing: ProviderSharing.PRIVATE,
      },
    });

    expect(onlyRow(wrapper).props("accessSummary")).toBe(
      "Marcel · settings.source_access.options.private",
    );
  });

  it("names another member's private source as not shared to the viewing admin", async () => {
    const wrapper = await mountProviders(ProviderStatus.LOADED, true, true, {
      access: {
        owner: "user-sam",
        shared_users: [],
        shared_playback: SharedPlayback.WITHOUT_OWN,
        sharing: ProviderSharing.PRIVATE,
      },
    });

    expect(onlyRow(wrapper).props("accessSummary")).toBe(
      "sam · settings.source_access.options.not_shared",
    );
  });

  it("opens the access dialog from the provider menu", async () => {
    const wrapper = await mountProviders(ProviderStatus.LOADED);

    const menuItems = await openMenu(wrapper);

    expect(
      menuItems.slice(0, 3).map((item: { label: string }) => item.label),
    ).toEqual([
      "settings.reconfigure",
      "settings.options",
      "settings.source_access.action",
    ]);

    menuItems[2].action();
    await flushPromises();

    const dialog = wrapper.get('[data-testid="access-dialog"]');
    expect(dialog.attributes("data-open")).toBe("true");
    expect(dialog.attributes("data-config")).toBe("spotify--test");
    expect(dialog.attributes("data-users")).toBe("2");
    expect(dialog.attributes("data-share-candidates")).toBe(
      "user-marcel,user-sam",
    );
    expect(dialog.attributes("data-can-change-owner")).toBe("true");
  });

  it("picks the members to share with from its user list", async () => {
    apiMock.getAllUsers.mockResolvedValue([
      owner,
      member,
      user({ user_id: "user-guest", username: "guest", role: UserRole.GUEST }),
      user({ user_id: "user-off", username: "off", enabled: false }),
    ]);

    const wrapper = await mountProviders(ProviderStatus.LOADED);

    expect(
      wrapper
        .get('[data-testid="access-dialog"]')
        .attributes("data-share-candidates"),
    ).toBe("user-marcel,user-sam,user-guest");
    expect(apiMock.getShareCandidates).not.toHaveBeenCalled();
  });

  it("hides the access action for a builtin provider", async () => {
    apiMock.providerManifests.spotify.builtin = true;

    const wrapper = await mountProviders(ProviderStatus.LOADED);

    const menuItems = await openMenu(wrapper);
    const accessItem = menuItems.find(
      (item: { label: string }) =>
        item.label === "settings.source_access.action",
    );
    expect(accessItem.hide).toBe(true);
    expect(onlyRow(wrapper).props("accessSummary")).toBeNull();
  });

  it("hides the access action for a player provider", async () => {
    pageType = ProviderType.PLAYER;

    const wrapper = await mountProviders(ProviderStatus.LOADED, true, true, {
      type: ProviderType.PLAYER,
    });

    const menuItems = await openMenu(wrapper);
    const accessItem = menuItems.find(
      (item: { label: string }) =>
        item.label === "settings.source_access.action",
    );
    expect(accessItem.hide).toBe(true);
    expect(onlyRow(wrapper).props("accessSummary")).toBeNull();
  });

  it("gives a list of providers that offer nothing and serve nobody no columns", async () => {
    pageType = ProviderType.PLAYER;

    const wrapper = await mountProviders(ProviderStatus.LOADED, true, true, {
      type: ProviderType.PLAYER,
    });

    expect(wrapper.find('[data-testid="provider-columns"]').exists()).toBe(
      false,
    );
    expect(onlyRow(wrapper).props("columns")).toEqual({
      offers: false,
      access: false,
    });
  });

  it("lists remove as the last menu item, marked as destructive", async () => {
    // a player provider also gets its conditional items, which must stay above
    pageType = ProviderType.PLAYER;
    apiMock.getProvider.mockReturnValue({
      available: true,
      domain: "spotify",
      instance_id: "spotify--test",
      is_streaming_provider: false,
      name: "Spotify",
      supported_features: [ProviderFeature.CREATE_GROUP_PLAYER],
      supported_artist_types: [],
      type: ProviderType.PLAYER,
    });

    const wrapper = await mountProviders(ProviderStatus.LOADED, true, true, {
      type: ProviderType.PLAYER,
    });

    const menuItems = await openMenu(wrapper);
    expect(
      menuItems.slice(-3).map((item: { label: string }) => item.label),
    ).toEqual([
      "settings.view_players",
      "settings.add_group_player",
      "settings.remove_provider",
    ]);
    expect(menuItems.at(-1).color).toBe("error");
  });

  it("opens the Catalog on the type of the page for an admin", async () => {
    pageType = ProviderType.PLAYER;
    const wrapper = await mountProviders(ProviderStatus.LOADED);

    await wrapper.get('[data-testid="add-provider"]').trigger("click");

    expect(routerMock.push).toHaveBeenCalledWith({
      name: "catalog",
      query: { types: "player" },
    });
  });

  it("offers reconfiguration of a provider that only an admin may set up", async () => {
    apiMock.providerManifests.spotify.self_service = false;

    const wrapper = await mountProviders(ProviderStatus.LOADED);

    const menuItems = await openMenu(wrapper);
    expect(menuItems[0].label).toBe("settings.reconfigure");
  });

  it("keeps the filter empty state for a provider type without any provider", async () => {
    pageType = ProviderType.PLAYER;

    const wrapper = await mountWithConfigs([]);

    expect(wrapper.find('[data-testid="music-sources-empty"]').exists()).toBe(
      false,
    );
    expect(wrapper.get("[data-testid=providers-empty]").text()).toContain(
      "no_content",
    );
    expect(wrapper.find('[data-testid="add-provider"]').exists()).toBe(true);
  });

  it("keeps the provider that ships with the server listed", async () => {
    const wrapper = await mountWithConfigs([builtinSource()]);

    expect(wrapper.findAllComponents(ProviderRowStub)).toHaveLength(1);
  });

  it("leaves out a provider with a settings page of its own, and lists the other plugins", async () => {
    pageType = ProviderType.PLUGIN;

    const wrapper = await mountWithConfigs([
      providerConfig({
        domain: "hass",
        instance_id: "hass",
        status: ProviderStatus.LOADED,
        type: ProviderType.PLUGIN,
      }),
      providerConfig({
        domain: "spotify_connect",
        instance_id: "spotify_connect--1",
        name: "Spotify Connect",
        status: ProviderStatus.LOADED,
        type: ProviderType.PLUGIN,
      }),
    ]);

    expect(
      wrapper
        .findAllComponents(ProviderRowStub)
        .map((row) => row.props("config").domain),
    ).toEqual(["spotify_connect"]);
  });

  it("lists every music source in a single section of a list headed by its Marketplace name", async () => {
    const wrapper = await mountWithConfigs([ownSource(), otherSource()]);

    expect(panels(wrapper)[0]).toEqual({
      list: ProviderType.MUSIC,
      title: "settings.music_sources",
      count: 2,
    });
    const sections = panelSections(wrapper, ProviderType.MUSIC);
    expect(sections).toHaveLength(1);
    expect(sections[0].find("h3").exists()).toBe(false);
    expect(sections[0].findAll('[data-testid="provider-row"]')).toHaveLength(2);
  });

  it.each([
    [ProviderType.METADATA, "settings.metadataproviders"],
    [ProviderType.PLAYER, "settings.playerproviders"],
  ])(
    "heads the %s providers with their Marketplace name",
    async (type, heading) => {
      pageType = type;

      const wrapper = await mountWithConfigs([
        providerConfig({
          domain: "spotify",
          instance_id: "spotify--1",
          status: ProviderStatus.LOADED,
          type,
        }),
      ]);

      expect(panels(wrapper).map(({ title }) => title)).toEqual([heading]);
    },
  );

  it("names the audio analysis providers the analysis modules", async () => {
    pageType = ProviderType.AUDIO_ANALYSIS;

    const wrapper = await mountWithConfigs([
      providerConfig({
        domain: "essentia",
        instance_id: "essentia--1",
        status: ProviderStatus.LOADED,
        type: ProviderType.AUDIO_ANALYSIS,
      }),
    ]);

    expect(panels(wrapper)).toEqual([
      {
        list: ProviderType.AUDIO_ANALYSIS,
        title: "settings.audio_analysis_modules",
        count: 1,
      },
    ]);
  });

  it("lists the plugins under their Marketplace name, below the header of their page", async () => {
    pageType = ProviderType.PLUGIN;

    const wrapper = await mountWithConfigs([
      providerConfig({
        domain: "party",
        instance_id: "party--1",
        status: ProviderStatus.LOADED,
        type: ProviderType.PLUGIN,
      }),
    ]);

    expect(panels(wrapper)).toEqual([
      { list: ProviderType.PLUGIN, title: "settings.plugins", count: 1 },
    ]);
    expect(wrapper.findAll('[data-testid="provider-row"]')).toHaveLength(1);
    expect(wrapper.find("h3").exists()).toBe(false);
    expect(
      wrapper.findComponent({ name: "SettingsPageHeader" }).props("page"),
    ).toBe("plugin_providers");
  });

  it("reports a failing user lookup", async () => {
    apiMock.getAllUsers.mockRejectedValue(new Error("no users"));

    await mountProviders(ProviderStatus.LOADED);

    expect(toastMock.error).toHaveBeenCalledWith("auth.users_load_failed");
  });
});

describe("Providers leading to the settings pages of their section", () => {
  it("leads Music to the library settings, the genres, the metadata and the audio analysis, saying how many providers run", async () => {
    apiMock.providers = {
      "fanarttv--1": providerInstance({
        domain: "fanarttv",
        type: ProviderType.METADATA,
      }),
      "musicbrainz--1": providerInstance({
        domain: "musicbrainz",
        type: ProviderType.METADATA,
      }),
      "spotify--1": providerInstance({ domain: "spotify" }),
    };

    const wrapper = await mountWithLinks();

    expect(linkRows(wrapper)).toEqual([
      { key: "library", to: { name: "librarysettings" } },
      { key: "genres", to: { name: "genremanagement" } },
      { key: "metadata", to: { name: "metadataproviders" } },
      { key: "audio_analysis", to: { name: "audioanalysisproviders" } },
    ]);
    expect(wrapper.findAll('[data-testid="settings-page-state"]')).toHaveLength(
      2,
    );
    expect(i18nMock.$t).toHaveBeenCalledWith("settings.providers_active", 2, {
      named: { count: 2 },
    });
    expect(i18nMock.$t).toHaveBeenCalledWith("settings.providers_active", 0, {
      named: { count: 0 },
    });
  });

  it.each([
    [Scope.CONFIG_CORE_WRITE, ["library"]],
    [Scope.LIBRARY_MANAGE, ["genres"]],
    [Scope.CONFIG_PROVIDERS_WRITE, ["metadata", "audio_analysis"]],
  ])(
    "leads a role granting only %s on Music where it may go",
    async (scope, keys) => {
      authMock.hasScope.mockImplementation(scopeChecker([scope]));

      const wrapper = await mountWithLinks();

      expect(linkRows(wrapper).map(({ key }) => key)).toEqual(keys);
    },
  );

  it("leads a member nowhere else from its music sources", async () => {
    authMock.hasScope.mockImplementation(
      scopeChecker(BUILTIN_ROLE_SCOPES.user),
    );

    const wrapper = await mountWithLinks();

    expect(wrapper.find('[data-testid^="settings-page-link-"]').exists()).toBe(
      false,
    );
  });
});

describe("Providers on a hub", () => {
  afterEach(() => {
    delete (apiMock.providerManifests as Record<string, unknown>)
      .airplay_receiver;
  });

  // the AirPlay receiver says in its manifest that apps play through it
  function withAirplayReceiver() {
    (apiMock.providerManifests as Record<string, unknown>).airplay_receiver = {
      ...apiMock.providerManifests.spotify,
      provides: [ProviderOffering.AUDIO_SOURCE],
      name: "AirPlay Receiver",
      type: ProviderType.PLUGIN,
    };
    return providerConfig({
      domain: "airplay_receiver",
      instance_id: "airplay_receiver--1",
      name: "AirPlay Receiver",
      status: ProviderStatus.LOADED,
      type: ProviderType.PLUGIN,
    });
  }

  it("heads Music with its title, and lists the audio sources with the music sources", async () => {
    const wrapper = await mountWithConfigs([
      ownSource(),
      withAirplayReceiver(),
    ]);

    expect(
      wrapper.findComponent({ name: "SettingsPageHeader" }).props("page"),
    ).toBe("music");
    expect(panels(wrapper)).toEqual([
      { list: ProviderType.MUSIC, title: "settings.music_sources", count: 2 },
    ]);
    expect(
      wrapper
        .get(`[data-list="${ProviderType.MUSIC}"]`)
        .findAll('[data-testid="provider-row"]')
        .map((row) => row.text()),
    ).toEqual(["AirPlay Receiver", "Own Spotify"]);
  });

  it("opens the Marketplace on the music sources from their list", async () => {
    const wrapper = await mountWithConfigs([ownSource()]);

    await wrapper
      .get(`[data-list="${ProviderType.MUSIC}"] [data-testid="add-provider"]`)
      .trigger("click");

    expect(routerMock.push).toHaveBeenCalledWith({
      name: "catalog",
      query: { types: ProviderType.MUSIC },
    });
  });

  it("no longer lists a plugin offering audio sources with the plugins", async () => {
    pageType = ProviderType.PLUGIN;

    const wrapper = await mountWithConfigs([
      withAirplayReceiver(),
      providerConfig({
        domain: "party",
        instance_id: "party--1",
        status: ProviderStatus.LOADED,
        type: ProviderType.PLUGIN,
      }),
    ]);

    expect(panels(wrapper)).toEqual([
      { list: ProviderType.PLUGIN, title: "settings.plugins", count: 1 },
    ]);
    expect(
      wrapper
        .findAllComponents(ProviderRowStub)
        .map((row) => row.props("config").domain),
    ).toEqual(["party"]);
  });

  it.each([
    [ProviderType.METADATA, "metadata"],
    [ProviderType.AUDIO_ANALYSIS, "audio_analysis"],
    [ProviderType.PLAYER, "player_support"],
  ])("heads the %s providers as their page", async (type, name) => {
    pageType = type;

    const wrapper = await mountWithConfigs([]);

    expect(
      wrapper.findComponent({ name: "SettingsPageHeader" }).props("page"),
    ).toBe(name);
  });

  it("switches the view from the header of a list", async () => {
    const toggleViewMode = vi.fn();
    const wrapper = await mountWithConfigs([ownSource()], "list", {
      toggleViewMode,
    });

    wrapper.getComponent(SettingsListPanel).vm.$emit("toggle-view-mode");

    expect(toggleViewMode).toHaveBeenCalledOnce();
    expect(wrapper.getComponent(SettingsListPanel).props("viewMode")).toBe(
      "list",
    );
  });
});

describe("Providers labelled with what they offer", () => {
  afterEach(() => {
    apiMock.providerManifests.spotify.provides = [];
    delete (apiMock.providerManifests as Record<string, unknown>)
      .airplay_receiver;
    delete (apiMock.providerManifests as Record<string, unknown>).podcastfeed;
    delete (apiMock.providerManifests as Record<string, unknown>).radio_browser;
  });

  // Spotify and a podcast feed that is not running say in their manifest what
  // they offer, and the AirPlay receiver that apps play through it; the running
  // Spotify also reports audiobooks, which its manifest leaves out
  function labelledSources(): ProviderConfig[] {
    const manifests = apiMock.providerManifests as Record<string, unknown>;
    apiMock.providerManifests.spotify.provides = [
      ProviderOffering.TRACK,
      ProviderOffering.PODCAST,
    ];
    manifests.airplay_receiver = {
      ...apiMock.providerManifests.spotify,
      provides: [ProviderOffering.AUDIO_SOURCE],
      name: "AirPlay Receiver",
      type: ProviderType.PLUGIN,
    };
    manifests.podcastfeed = {
      ...apiMock.providerManifests.spotify,
      provides: [ProviderOffering.PODCAST],
      name: "Podcast feed",
      type: ProviderType.MUSIC,
    };
    apiMock.providers = {
      "spotify--own": providerInstance({
        domain: "spotify",
        instance_id: "spotify--own",
        supported_features: [
          ProviderFeature.LIBRARY_TRACKS,
          ProviderFeature.LIBRARY_AUDIOBOOKS,
        ],
      }),
    };
    return [
      ownSource(),
      providerConfig({
        domain: "podcastfeed",
        enabled: false,
        instance_id: "podcastfeed--1",
        name: "Podcast feed",
        status: ProviderStatus.DISABLED,
      }),
      providerConfig({
        domain: "airplay_receiver",
        instance_id: "airplay_receiver--1",
        name: "AirPlay Receiver",
        status: ProviderStatus.LOADED,
        type: ProviderType.PLUGIN,
      }),
    ];
  }

  // the instance ids of the rows, in their order
  function rowIds(wrapper: Awaited<ReturnType<typeof mountWithConfigs>>) {
    return wrapper
      .findAllComponents(ProviderRowStub)
      .map((row) => row.props("config").instance_id);
  }

  function chips(wrapper: Awaited<ReturnType<typeof mountWithConfigs>>) {
    return wrapper
      .findAll('[data-testid="provider-label-filter"] button')
      .map((chip) => ({
        label: chip.attributes("data-label"),
        pressed: chip.attributes("aria-pressed"),
      }));
  }

  async function pickChip(
    wrapper: Awaited<ReturnType<typeof mountWithConfigs>>,
    label: string,
  ) {
    await wrapper
      .get(`[data-testid="provider-label-filter"] [data-label="${label}"]`)
      .trigger("click");
  }

  it("hands each row what its manifest says it offers, whatever a running source reports", async () => {
    const wrapper = await mountWithConfigs(labelledSources());

    expect(rowFor(wrapper, "spotify--own").props("labels")).toEqual([
      "library",
      "podcasts",
    ]);
    expect(rowFor(wrapper, "podcastfeed--1").props("labels")).toEqual([
      "podcasts",
    ]);
    expect(rowFor(wrapper, "airplay_receiver--1").props("labels")).toEqual([
      "live",
    ]);
  });

  it("gives the list a column for what its sources offer and who can use them", async () => {
    const wrapper = await mountWithConfigs(labelledSources());

    expect(
      wrapper
        .findAll('[data-testid="provider-columns"] span')
        .map((column) => column.text()),
    ).toEqual([
      "settings.provider_columns.name",
      "settings.provider_columns.offers",
      "settings.provider_columns.access",
    ]);
    expect(rowFor(wrapper, "spotify--own").props("columns")).toEqual({
      offers: true,
      access: true,
    });
  });

  it("offers a chip for every label a listed source has, after All", async () => {
    const wrapper = await mountWithConfigs(labelledSources());

    expect(chips(wrapper)).toEqual([
      { label: "all", pressed: "true" },
      { label: "library", pressed: "false" },
      { label: "podcasts", pressed: "false" },
      { label: "live", pressed: "false" },
    ]);
  });

  it("narrows the list down to the sources offering the chip picked, and back with All", async () => {
    const wrapper = await mountWithConfigs(labelledSources());

    await pickChip(wrapper, "podcasts");

    expect(rowIds(wrapper)).toEqual(["spotify--own", "podcastfeed--1"]);
    expect(panels(wrapper)[0].count).toBe(2);
    expect(chips(wrapper).find((chip) => chip.pressed === "true")?.label).toBe(
      "podcasts",
    );

    await pickChip(wrapper, "live");
    expect(rowIds(wrapper)).toEqual(["airplay_receiver--1"]);

    await pickChip(wrapper, "all");
    expect(rowIds(wrapper)).toHaveLength(3);
  });

  it("combines the chip with the search", async () => {
    const wrapper = await mountWithConfigs([
      ...labelledSources(),
      ...spotifyConfigs(9),
    ]);

    await pickChip(wrapper, "podcasts");
    wrapper
      .findComponent({ name: "ProviderFilters" })
      .vm.$emit("update:search", "podcast");
    await flushPromises();

    expect(rowIds(wrapper)).toEqual(["podcastfeed--1"]);

    wrapper
      .findComponent({ name: "ProviderFilters" })
      .vm.$emit("update:search", "airplay");
    await flushPromises();

    expect(rowIds(wrapper)).toEqual([]);
    expect(wrapper.find("[data-testid=providers-empty]").exists()).toBe(true);
  });

  it("offers no chips while the listed sources have a single label between them", async () => {
    apiMock.providerManifests.spotify.provides = [ProviderOffering.TRACK];

    const wrapper = await mountWithConfigs([ownSource(), otherSource()]);

    expect(rowFor(wrapper, "spotify--own").props("labels")).toEqual([
      "library",
    ]);
    expect(wrapper.find('[data-testid="provider-label-filter"]').exists()).toBe(
      false,
    );
  });

  it("narrows a member's own and shared sources down alike", async () => {
    authMock.hasScope.mockImplementation(
      scopeChecker(BUILTIN_ROLE_SCOPES.user),
    );
    apiMock.providerManifests.spotify.provides = [ProviderOffering.TRACK];
    (apiMock.providerManifests as Record<string, unknown>).radio_browser = {
      ...apiMock.providerManifests.spotify,
      name: "Radio Browser",
      provides: [ProviderOffering.RADIO],
    };

    const wrapper = await mountWithConfigs([
      ownSource(),
      { ...otherSource(), domain: "radio_browser" },
      householdSource(),
    ]);
    await pickChip(wrapper, "library");

    expect(
      panelSections(wrapper, ProviderType.MUSIC).map((section) => [
        section.attributes("data-section"),
        section
          .findAll('[data-testid="provider-row"]')
          .map((row) => row.text()),
      ]),
    ).toEqual([
      ["own", ["Own Spotify"]],
      ["shared", ["Household Spotify"]],
    ]);
  });

  describe("on the Plugins page", () => {
    const PLUGINS: Record<string, ProviderOffering[]> = {
      lastfm: [ProviderOffering.SCROBBLE],
      openai: [ProviderOffering.AI, ProviderOffering.TTS],
      party: [ProviderOffering.FUN],
      // a plugin naming nothing it delivers
      mystery: [],
    };

    beforeEach(() => {
      pageType = ProviderType.PLUGIN;
    });

    afterEach(() => {
      for (const domain of Object.keys(PLUGINS)) {
        delete (apiMock.providerManifests as Record<string, unknown>)[domain];
      }
    });

    function labelledPlugins(domains = Object.keys(PLUGINS)): ProviderConfig[] {
      const manifests = apiMock.providerManifests as Record<string, unknown>;
      return domains.map((domain) => {
        manifests[domain] = {
          ...apiMock.providerManifests.spotify,
          name: domain,
          provides: PLUGINS[domain],
          type: ProviderType.PLUGIN,
        };
        return providerConfig({
          domain,
          instance_id: `${domain}--1`,
          name: domain,
          status: ProviderStatus.LOADED,
          type: ProviderType.PLUGIN,
        });
      });
    }

    it("hands each row what its plugin delivers, other when it names nothing", async () => {
      const wrapper = await mountWithConfigs(labelledPlugins());

      expect(rowFor(wrapper, "openai--1").props("labels")).toEqual([
        "ai",
        "tts",
      ]);
      expect(rowFor(wrapper, "mystery--1").props("labels")).toEqual(["other"]);
    });

    it("offers a chip for every label a listed plugin has, after All and with Other last", async () => {
      const wrapper = await mountWithConfigs(labelledPlugins());

      expect(chips(wrapper).map((chip) => chip.label)).toEqual([
        "all",
        "ai",
        "tts",
        "scrobble",
        "fun",
        "other",
      ]);
    });

    it("narrows the list down to the plugins offering the chip picked", async () => {
      const wrapper = await mountWithConfigs(labelledPlugins());

      await pickChip(wrapper, "tts");
      expect(rowIds(wrapper)).toEqual(["openai--1"]);

      await pickChip(wrapper, "other");
      expect(rowIds(wrapper)).toEqual(["mystery--1"]);

      await pickChip(wrapper, "all");
      expect(rowIds(wrapper)).toHaveLength(4);
    });

    it("offers no chips while the listed plugins have a single label between them", async () => {
      const wrapper = await mountWithConfigs(labelledPlugins(["lastfm"]));

      expect(
        wrapper.find('[data-testid="provider-label-filter"]').exists(),
      ).toBe(false);
    });
  });
});

describe("Providers on the page of a type", () => {
  const LIST_TYPES = [
    ProviderType.METADATA,
    ProviderType.AUDIO_ANALYSIS,
    ProviderType.PLAYER,
    ProviderType.PLUGIN,
  ];

  // a provider of every type on the page lists
  const oneOfEach = () =>
    LIST_TYPES.map((type) =>
      providerConfig({
        domain: `${type}_provider`,
        instance_id: `${type}_provider--1`,
        status: ProviderStatus.LOADED,
        type,
      }),
    );

  it.each(LIST_TYPES)(
    "lists the %s providers on their page, alone",
    async (type) => {
      pageType = type;

      const wrapper = await mountWithConfigs(oneOfEach());

      expect(panels(wrapper).map(({ list }) => list)).toEqual([type]);
      expect(
        wrapper
          .findAllComponents(ProviderRowStub)
          .map((row) => row.props("config").type),
      ).toEqual([type]);
    },
  );

  it("lists another type once its route hands it one", async () => {
    pageType = ProviderType.PLUGIN;
    const wrapper = await mountWithConfigs(oneOfEach());

    await wrapper.setProps({ type: ProviderType.PLAYER });

    expect(panels(wrapper).map(({ list }) => list)).toEqual([
      ProviderType.PLAYER,
    ]);
  });

  it("starts the list of another type without the search of the previous one", async () => {
    // enough of each type for the list to offer its search
    const tenOf = (type: ProviderType) =>
      Array.from({ length: 10 }, (_, index) =>
        providerConfig({
          domain: `${type}_provider`,
          instance_id: `${type}_provider--${index}`,
          status: ProviderStatus.LOADED,
          type,
        }),
      );
    pageType = ProviderType.PLUGIN;
    const wrapper = await mountWithConfigs([
      ...tenOf(ProviderType.PLUGIN),
      ...tenOf(ProviderType.PLAYER),
    ]);
    wrapper
      .findComponent({ name: "ProviderFilters" })
      .vm.$emit("update:search", "nothing matches this");
    await flushPromises();
    expect(wrapper.findAllComponents(ProviderRowStub)).toHaveLength(0);

    await wrapper.setProps({ type: ProviderType.PLAYER });
    await flushPromises();

    expect(wrapper.findAllComponents(ProviderRowStub)).toHaveLength(10);
  });

  it("tells an admin about the ones of its type that moved to the community catalog", async () => {
    pageType = ProviderType.PLAYER;
    apiMock.getCommunityProviders.mockResolvedValue([
      communityProvider("radio", {
        state: CommunityProviderState.INSTALLED,
        notice: "moved",
        manifest: providerManifest({
          domain: "radio",
          name: "radio",
          type: ProviderType.MUSIC,
        }),
      }),
      communityProvider("speaker", {
        state: CommunityProviderState.INSTALLED,
        notice: "moved",
        manifest: providerManifest({
          domain: "speaker",
          name: "speaker",
          type: ProviderType.PLAYER,
        }),
      }),
    ]);

    const wrapper = await mountWithConfigs([]);

    expect(
      wrapper
        .getComponent(CommunityMovedNotice)
        .props("providers")
        .map((provider: { domain: string }) => provider.domain),
    ).toEqual(["speaker"]);
  });
});

describe("Providers with something that moved to the community catalog", () => {
  const moved = (domain: string, type: ProviderType) =>
    communityProvider(domain, {
      state: CommunityProviderState.INSTALLED,
      notice: "moved",
      manifest: providerManifest({ domain, name: domain, type }),
    });

  beforeEach(() => {
    apiMock.getCommunityProviders.mockResolvedValue([
      moved("radio", ProviderType.MUSIC),
      moved("speaker", ProviderType.PLAYER),
      communityProvider("fm", { state: CommunityProviderState.INSTALLED }),
    ]);
  });

  it("tells an admin about the ones of the type of the page", async () => {
    const wrapper = await mountProviders(ProviderStatus.LOADED);

    const notice = wrapper.getComponent(CommunityMovedNotice);
    expect(
      notice
        .props("providers")
        .map((provider: { domain: string }) => provider.domain),
    ).toEqual(["radio"]);
  });

  it("dismisses one with the server", async () => {
    apiMock.dismissCommunityNotice.mockResolvedValue(undefined);
    const wrapper = await mountProviders(ProviderStatus.LOADED);
    const notice = wrapper.getComponent(CommunityMovedNotice);

    notice.vm.$emit("dismiss", notice.props("providers")[0]);
    await flushPromises();

    expect(apiMock.dismissCommunityNotice).toHaveBeenCalledWith("radio");
    expect(notice.props("providers")).toEqual([]);
  });

  it("still lists what is set up when the server refuses the community catalog", async () => {
    apiMock.getCommunityProviders.mockRejectedValue(
      new Error("not available in safe mode"),
    );

    const wrapper = await mountProviders(ProviderStatus.LOADED);

    expect(wrapper.findAllComponents(ProviderRowStub)).toHaveLength(1);
    expect(
      wrapper.getComponent(CommunityMovedNotice).props("providers"),
    ).toEqual([]);
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it("tells a member nothing and asks the server nothing", async () => {
    authMock.hasScope.mockImplementation(
      scopeChecker(BUILTIN_ROLE_SCOPES.user),
    );

    const wrapper = await mountProviders(ProviderStatus.LOADED);

    expect(
      wrapper.getComponent(CommunityMovedNotice).props("providers"),
    ).toEqual([]);
    expect(apiMock.getCommunityProviders).not.toHaveBeenCalled();
    expect(apiMock.getCoreConfig).not.toHaveBeenCalled();
  });
});

describe("Providers for a member", () => {
  beforeEach(() => {
    authMock.hasScope.mockImplementation(
      scopeChecker(BUILTIN_ROLE_SCOPES.user),
    );
  });

  it("lists the music sources it may use, and no other provider", async () => {
    const wrapper = await mountWithConfigs([
      ownSource(),
      otherSource(),
      playerProvider(),
    ]);

    const rows = wrapper.findAll('[data-testid="provider-row"]');
    expect(rows).toHaveLength(2);
    expect(rows[0].text()).toContain("Own Spotify");
    expect(rows[1].text()).toContain("Shared Spotify");
  });

  it("splits its own sources from the ones shared with it", async () => {
    const wrapper = await mountWithConfigs([
      ownSource(),
      otherSource(),
      householdSource(),
    ]);

    const sections = wrapper.findAll('[data-testid="provider-section"]');
    expect(
      sections.map((section) => section.attributes("data-section")),
    ).toEqual(["own", "shared"]);
    expect(sections[0].get("h3").text()).toBe("settings.music_sources_own");
    expect(sections[1].get("h3").text()).toBe("settings.music_sources_shared");

    expect(
      sections[0]
        .findAll('[data-testid="provider-row"]')
        .map((row) => row.text()),
    ).toEqual([expect.stringContaining("Own Spotify")]);
    expect(
      sections[1]
        .findAll('[data-testid="provider-row"]')
        .map((row) => row.text()),
    ).toEqual([
      expect.stringContaining("Household Spotify"),
      expect.stringContaining("Shared Spotify"),
    ]);
  });

  it("heads its sources by whose they are, in the list of its music sources alone", async () => {
    const wrapper = await mountWithConfigs([ownSource(), otherSource()]);

    expect(panels(wrapper)).toEqual([
      { list: ProviderType.MUSIC, title: "settings.music_sources", count: 2 },
    ]);
    expect(wrapper.findAll("h3").map((h3) => h3.text())).toEqual([
      "settings.music_sources_own",
      "settings.music_sources_shared",
    ]);
  });

  it("hands its own sources the manage flags and the ones shared with it none", async () => {
    const wrapper = await mountWithConfigs([ownSource(), otherSource()]);

    const own = rowFor(wrapper, "spotify--own");
    expect(own.props("manageable")).toBe(true);
    expect(own.props("accessSummary")).not.toBeNull();

    const shared = rowFor(wrapper, "spotify--other");
    expect(shared.props("manageable")).toBe(false);
    expect(shared.props("accessSummary")).toBeNull();
  });

  it("keeps the sources shared with it read-only in the card view too", async () => {
    const wrapper = await mountWithConfigs(
      [ownSource(), { ...otherSource(), status: ProviderStatus.AUTH_REQUIRED }],
      "card",
    );

    const own = rowFor(wrapper, "spotify--own");
    expect(own.props("variant")).toBe("card");
    expect(own.props("manageable")).toBe(true);
    expect(own.props("accessSummary")).not.toBeNull();

    const shared = rowFor(wrapper, "spotify--other");
    expect(shared.props("variant")).toBe("card");
    expect(shared.props("manageable")).toBe(false);
    expect(shared.props("accessSummary")).toBeNull();
    // the server refuses to set up a source the member does not own
    expect(shared.props("reconfigurable")).toBe(false);
    expect(shared.props("statusLabel")).toBe(
      "settings.provider_status_auth_required",
    );
  });

  it("offers no reconfiguration of a source shared with it", async () => {
    // the server refuses to set up a source the member does not own
    const wrapper = await mountWithConfigs([
      { ...otherSource(), status: ProviderStatus.AUTH_REQUIRED },
    ]);

    const row = onlyRow(wrapper);
    expect(row.props("manageable")).toBe(false);
    expect(row.props("reconfigurable")).toBe(false);
  });

  it("leaves out the provider that ships with the server", async () => {
    // the server serves it to everyone, but it is not a source anyone shared
    const wrapper = await mountWithConfigs([ownSource(), builtinSource()]);

    const rows = wrapper.findAll('[data-testid="provider-row"]');
    expect(rows).toHaveLength(1);
    expect(rows[0].text()).toContain("Own Spotify");
    expect(wrapper.find('[data-section="shared"]').exists()).toBe(false);
  });

  it("summarizes its own source by the sharing alone", async () => {
    const wrapper = await mountWithConfigs([ownSource()]);

    expect(onlyRow(wrapper).props("accessSummary")).toBe(
      "settings.source_access.options.private",
    );
  });

  it("offers the actions on its own source and hides the administrative ones", async () => {
    apiMock.getProvider.mockReturnValue({
      available: true,
      domain: "spotify",
      instance_id: "spotify--own",
      is_streaming_provider: true,
      name: "Own Spotify",
      supported_features: [],
      supported_artist_types: [],
      type: ProviderType.MUSIC,
    });

    const wrapper = await mountWithConfigs([ownSource()]);

    const menuItems = await openMenu(wrapper);
    expect(
      menuItems
        .filter((item: { hide?: boolean }) => !item.hide)
        .map((item: { label: string }) => item.label),
    ).toEqual([
      "settings.reconfigure",
      "settings.options",
      "settings.source_access.share_action",
      "settings.disable",
      "settings.documentation",
      "settings.reload",
      "settings.remove_provider",
    ]);
    expect(
      menuItems.map((item: { label: string }) => item.label),
    ).not.toContain("settings.source_access.action");
  });

  it("opens the sharing dialog with the members it may share with", async () => {
    const wrapper = await mountWithConfigs([ownSource()]);

    const menuItems = await openMenu(wrapper);
    menuItems
      .find(
        (item: { label: string }) =>
          item.label === "settings.source_access.share_action",
      )
      .action();
    await flushPromises();

    const dialog = wrapper.get('[data-testid="access-dialog"]');
    expect(dialog.attributes("data-open")).toBe("true");
    expect(dialog.attributes("data-config")).toBe("spotify--own");
    expect(dialog.attributes("data-users")).toBe("none");
    expect(dialog.attributes("data-share-candidates")).toBe(
      "user-marcel,user-sam",
    );
    expect(dialog.attributes("data-can-change-owner")).toBe("false");
  });

  it("does not list the users", async () => {
    await mountWithConfigs([ownSource()]);

    expect(apiMock.getAllUsers).not.toHaveBeenCalled();
  });

  it("reports a failing lookup of the members it may share with", async () => {
    apiMock.getShareCandidates.mockRejectedValue(new Error("refused"));

    const wrapper = await mountWithConfigs([ownSource()]);

    expect(toastMock.error).toHaveBeenCalledWith("auth.users_load_failed");
    expect(
      wrapper
        .get('[data-testid="access-dialog"]')
        .attributes("data-share-candidates"),
    ).toBe("none");
  });

  it("opens the Catalog on the music sources", async () => {
    const wrapper = await mountWithConfigs([ownSource()]);

    await wrapper.get('[data-testid="add-provider"]').trigger("click");

    // the Catalog itself keeps a member to what it may add
    expect(routerMock.push).toHaveBeenCalledWith({
      name: "catalog",
      query: { types: "music" },
    });
  });

  it("opens the Catalog from the invitation to add a first source", async () => {
    const wrapper = await mountWithConfigs([]);

    await wrapper.get('[data-testid="add-provider-empty"]').trigger("click");

    expect(routerMock.push).toHaveBeenCalledWith({
      name: "catalog",
      query: { types: "music" },
    });
  });

  it("offers no reconfiguration of a provider that only an admin may set up", async () => {
    apiMock.providerManifests.spotify.self_service = false;

    const wrapper = await mountWithConfigs([
      { ...ownSource(), status: ProviderStatus.AUTH_REQUIRED },
    ]);

    expect(onlyRow(wrapper).props("reconfigurable")).toBe(false);
    const menuItems = await openMenu(wrapper);
    expect(
      menuItems.map((item: { label: string }) => item.label),
    ).not.toContain("settings.reconfigure");

    // the server would refuse the setup flow, so the source opens its options
    onlyRow(wrapper).vm.$emit("open");
    expect(routerMock.push).toHaveBeenCalledWith(
      "/settings/editprovider/spotify--own",
    );
    expect(eventbusMock.emit).not.toHaveBeenCalledWith(
      "setupFlowDialog",
      expect.anything(),
    );
  });

  it("invites a member without any source to add one", async () => {
    const wrapper = await mountWithConfigs([]);

    expect(wrapper.get('[data-testid="music-sources-empty"]').text()).toContain(
      "settings.music_sources_empty_title",
    );
    expect(wrapper.find('[data-testid="add-provider"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="add-provider-empty"]').exists()).toBe(
      true,
    );
  });

  it("shows a member without sources of its own what it may use", async () => {
    const wrapper = await mountWithConfigs([otherSource()]);

    expect(wrapper.get('[data-section="shared"]').get("h3").text()).toBe(
      "settings.music_sources_shared",
    );
    expect(wrapper.find('[data-testid="music-sources-empty"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-testid="add-provider"]').exists()).toBe(true);
  });
});

describe("Providers for a member that may not add sources", () => {
  beforeEach(() => {
    authMock.hasScope.mockImplementation(
      scopeChecker(MEMBER_WITHOUT_OWN_SCOPES),
    );
  });

  it("lists what is shared with it without offering to add a source", async () => {
    const wrapper = await mountWithConfigs([otherSource()]);

    const rows = wrapper
      .get('[data-section="shared"]')
      .findAll('[data-testid="provider-row"]');
    expect(rows).toHaveLength(1);
    expect(rows[0].text()).toContain("Shared Spotify");
    expect(wrapper.find('[data-testid="add-provider"]').exists()).toBe(false);
    // the server refuses both lookups to a role that owns no sources
    expect(apiMock.getShareCandidates).not.toHaveBeenCalled();
    expect(apiMock.getAllUsers).not.toHaveBeenCalled();
  });

  it("shows the sources it owns read-only once its role may no longer own sources", async () => {
    const wrapper = await mountWithConfigs([ownSource()]);

    const row = rowFor(wrapper, "spotify--own");
    expect(row.props("manageable")).toBe(false);
    expect(row.props("accessSummary")).toBeNull();
  });

  it("tells it nothing has been shared yet, without an invitation to add a source", async () => {
    const wrapper = await mountWithConfigs([]);

    const empty = wrapper.get('[data-testid="music-sources-empty"]');
    expect(empty.text()).toContain("settings.music_sources_empty_title");
    expect(empty.text()).toContain("settings.music_sources_shared_empty");
    // the invitation to connect an account is for whoever may add a source
    expect(empty.text()).not.toMatch(/music_sources_empty(?!_title)/);
    expect(empty.find('[data-testid="add-provider-empty"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-testid="add-provider"]').exists()).toBe(false);
    expect(wrapper.find("[data-testid=providers-empty]").exists()).toBe(false);
  });
});

describe("Providers loading", () => {
  it("narrows a member's load to the music sources", async () => {
    authMock.hasScope.mockImplementation(
      scopeChecker(BUILTIN_ROLE_SCOPES.user),
    );

    await mountWithConfigs([]);

    expect(apiMock.getProviderConfigs).toHaveBeenCalledWith(
      ProviderType.MUSIC,
      undefined,
      true,
    );
  });

  it("gives a role that manages only its own music sources the member view", async () => {
    authMock.hasScope.mockImplementation(scopeChecker(OWN_SOURCES_ROLE_SCOPES));

    await mountWithConfigs([]);

    expect(apiMock.getProviderConfigs).toHaveBeenCalledWith(
      ProviderType.MUSIC,
      undefined,
      true,
    );
    expect(apiMock.getAllUsers).not.toHaveBeenCalled();
    expect(apiMock.getShareCandidates).toHaveBeenCalled();
  });

  it("reports a failing load and shows no empty state", async () => {
    const wrapper = await mountWithConfigs(
      Promise.reject(new Error("offline")),
    );

    expect(toastMock.error).toHaveBeenCalledWith("Error: offline");
    expect(wrapper.find('[data-testid="music-sources-empty"]').exists()).toBe(
      false,
    );
  });

  it("flags a source that needs attention with its status", async () => {
    const wrapper = await mountProviders(ProviderStatus.AUTH_REQUIRED);

    expect(onlyRow(wrapper).props("statusVariant")).toBe("destructive");
    expect(onlyRow(wrapper).props("statusIcon")).toBeUndefined();
    expect(onlyRow(wrapper).props("statusLabel")).toBe(
      "settings.provider_status_auth_required",
    );
  });

  it.each([
    [ProviderStatus.LOADING, "loading", "settings.provider_status_loading"],
    [ProviderStatus.DISABLED, "disabled", "settings.provider_status_disabled"],
  ])(
    "shows a %s source as an icon instead of a badge",
    async (status, icon, label) => {
      const wrapper = await mountProviders(status);

      expect(onlyRow(wrapper).props("statusVariant")).toBeUndefined();
      expect(onlyRow(wrapper).props("statusIcon")).toBe(icon);
      expect(onlyRow(wrapper).props("statusLabel")).toBe(label);
    },
  );

  it("shows a running source without a status", async () => {
    const wrapper = await mountProviders(ProviderStatus.LOADED);

    expect(onlyRow(wrapper).props("statusVariant")).toBeUndefined();
    expect(onlyRow(wrapper).props("statusIcon")).toBeUndefined();
  });

  describe("an entry whose provider is not available", () => {
    const unavailable = () =>
      providerConfig({
        domain: "radio",
        instance_id: "radio--a",
        name: "",
        default_name: "Radio Garden",
        status: ProviderStatus.UNAVAILABLE,
        last_error: {
          error_code: 61,
          message:
            "The community catalog blocked this (It sends data elsewhere), so it no longer runs.",
        },
      });

    it("is listed as not available with its reason, and cannot be opened", async () => {
      const wrapper = await mountWithConfigs([unavailable()]);

      const row = onlyRow(wrapper);
      expect(row.props()).toMatchObject({
        name: "Radio Garden",
        manageable: false,
        removable: true,
        reconfigurable: false,
        isError: true,
        statusVariant: "destructive",
        statusLabel: "settings.provider_status_unavailable",
        errorText:
          "The community catalog blocked this (It sends data elsewhere), so it no longer runs.",
      });
    });

    it("is removed after the usual confirmation", async () => {
      apiMock.removeProviderConfig.mockResolvedValue(undefined);
      const wrapper = await mountWithConfigs([unavailable()]);

      onlyRow(wrapper).vm.$emit("remove");
      const removeCall = eventbusMock.emit.mock.calls.find(
        ([event]) => event === "deleteConfirmationDialog",
      );
      expect(removeCall?.[1].message).toBe(
        "settings.remove_provider_confirm_music",
      );
      expect(apiMock.removeProviderConfig).not.toHaveBeenCalled();

      await removeCall?.[1].onConfirm();
      await flushPromises();

      expect(apiMock.removeProviderConfig).toHaveBeenCalledWith("radio--a");
      expect(wrapper.findAllComponents(ProviderRowStub)).toHaveLength(0);
    });

    it("is not removable for a member who does not own it", async () => {
      authMock.hasScope.mockImplementation(
        scopeChecker(BUILTIN_ROLE_SCOPES.user),
      );
      const wrapper = await mountWithConfigs([
        { ...otherSource(), status: ProviderStatus.UNAVAILABLE },
      ]);

      expect(onlyRow(wrapper).props("removable")).toBe(false);
    });
  });

  it("shows no empty state until the providers are loaded", async () => {
    const wrapper = await mountWithConfigs(new Promise(() => {}));

    expect(wrapper.find('[data-testid="music-sources-empty"]').exists()).toBe(
      false,
    );
    expect(wrapper.find("[data-testid=providers-empty]").exists()).toBe(false);
    expect(wrapper.find('[data-testid="add-provider"]').exists()).toBe(true);
  });
});

describe("Providers search", () => {
  it("offers the search from ten listed providers on", async () => {
    const wrapper = await mountWithConfigs(spotifyConfigs(10));

    expect(wrapper.findComponent({ name: "ProviderFilters" }).exists()).toBe(
      true,
    );
  });

  it("hides the search below ten listed providers", async () => {
    const wrapper = await mountWithConfigs(spotifyConfigs(9));

    expect(wrapper.findComponent({ name: "ProviderFilters" }).exists()).toBe(
      false,
    );
  });

  it("counts only the providers of the listed type", async () => {
    const wrapper = await mountWithConfigs([
      ...spotifyConfigs(9),
      providerConfig({
        domain: "sonos",
        instance_id: "sonos--1",
        type: ProviderType.PLAYER,
      }),
    ]);

    expect(wrapper.findComponent({ name: "ProviderFilters" }).exists()).toBe(
      false,
    );
  });

  it("keeps the search while a query narrows the list down", async () => {
    const wrapper = await mountWithConfigs(spotifyConfigs(10));

    wrapper
      .findComponent({ name: "ProviderFilters" })
      .vm.$emit("update:search", "nothing matches this");
    await flushPromises();

    expect(wrapper.findAllComponents(ProviderRowStub)).toHaveLength(0);
    expect(wrapper.findComponent({ name: "ProviderFilters" }).exists()).toBe(
      true,
    );
    // an empty search result is not an invitation to add a first source
    expect(wrapper.find('[data-testid="music-sources-empty"]').exists()).toBe(
      false,
    );
    expect(wrapper.find("[data-testid=providers-empty]").exists()).toBe(true);
  });
});

function ownSource() {
  return providerConfig({
    access: {
      owner: owner.user_id,
      shared_users: [],
      shared_playback: SharedPlayback.WITHOUT_OWN,
      sharing: ProviderSharing.PRIVATE,
    },
    domain: "spotify",
    instance_id: "spotify--own",
    name: "Own Spotify",
    status: ProviderStatus.LOADED,
  });
}

function otherSource() {
  return providerConfig({
    access: {
      owner: member.user_id,
      shared_users: [],
      shared_playback: SharedPlayback.WITHOUT_OWN,
      sharing: ProviderSharing.PRIVATE,
    },
    domain: "spotify",
    instance_id: "spotify--other",
    name: "Shared Spotify",
    status: ProviderStatus.LOADED,
  });
}

// a source nobody owns, which the server serves to every user
function householdSource() {
  return providerConfig({
    access: {
      owner: null,
      shared_users: [],
      shared_playback: SharedPlayback.WITHOUT_OWN,
      sharing: ProviderSharing.EVERYONE,
    },
    domain: "spotify",
    instance_id: "spotify--household",
    name: "Household Spotify",
    status: ProviderStatus.LOADED,
  });
}

// the library provider every server ships with, which nobody owns
function builtinSource() {
  return providerConfig({
    domain: "builtin",
    instance_id: "builtin--builtin",
    name: "Music Assistant",
    status: ProviderStatus.LOADED,
  });
}

function playerProvider() {
  return providerConfig({
    domain: "spotify",
    instance_id: "spotify--player",
    name: "Spotify Connect",
    status: ProviderStatus.LOADED,
    type: ProviderType.PLAYER,
  });
}

/** The given number of loaded spotify sources, each with its own name. */
function spotifyConfigs(count: number): ProviderConfig[] {
  return Array.from({ length: count }, (_, index) =>
    providerConfig({
      domain: "spotify",
      instance_id: `spotify--${index}`,
      name: `Spotify ${index}`,
      status: ProviderStatus.LOADED,
    }),
  );
}

async function mountProviders(
  status: ProviderStatus,
  hasSetupFlow: boolean = true,
  enabled: boolean = true,
  configOverrides: Partial<ProviderConfig> = {},
) {
  apiMock.providerManifests.spotify.has_setup_flow = hasSetupFlow;
  return mountWithConfigs([
    providerConfig({
      domain: "spotify",
      enabled,
      instance_id: "spotify--test",
      last_error: {
        error_code: 1,
        message: "Authentication required",
      },
      name: "Spotify",
      status,
      ...configOverrides,
    }),
  ]);
}

// a pending promise keeps the page in its loading state
async function mountWithConfigs(
  configs: ProviderConfig[] | Promise<ProviderConfig[]>,
  viewMode: "list" | "card" = "list",
  { toggleViewMode = vi.fn() } = {},
) {
  apiMock.getProviderConfigs.mockReturnValue(Promise.resolve(configs));

  const wrapper = mountPage({
    global: {
      mocks: {
        $t: (key: string) => key,
      },
      provide: {
        providersViewMode: {
          toggleViewMode,
          viewMode: ref<"list" | "card">(viewMode),
        },
      },
      stubs: {
        Button: ButtonStub,
        Card: SlotStub,
        CommunityMovedTypeNotice: false,
        Container: SlotStub,
        Empty: SlotStub,
        EmptyContent: SlotStub,
        EmptyDescription: SlotStub,
        EmptyHeader: SlotStub,
        EmptyMedia: SlotStub,
        EmptyTitle: SlotStub,
        FilterEmptyState: false,
        ItemGroup: SlotStub,
        ProviderAccessDialog: AccessDialogStub,
        ProviderList: false,
        ProviderListPanel: false,
        ProviderRow: ProviderRowStub,
        // the panel holds the list, its heading and its add button
        SettingsListPanel: false,
        ProviderLabelFilter: false,
        "v-icon": true,
      },
    },
  });
  await flushPromises();
  return wrapper;
}

// with the rows leading to the settings pages rendered, so they can be read
async function mountWithLinks() {
  apiMock.getProviderConfigs.mockResolvedValue([]);
  const wrapper = mountPage({
    global: {
      mocks: { $t: (key: string) => key },
      provide: {
        providersViewMode: {
          toggleViewMode: vi.fn(),
          viewMode: ref<"list" | "card">("list"),
        },
      },
      stubs: {
        RouterLink: {
          props: ["to"],
          template: '<a :href="JSON.stringify(to)"><slot /></a>',
        },
        SettingsPageLinks: false,
        SettingsTiles: false,
      },
    },
  });
  await flushPromises();
  return wrapper;
}

// the pages listing the providers of a type along with more of their own; any
// other type is listed on the page its route hands the type
const OWN_PAGES: Partial<Record<ProviderType, Component>> = {
  [ProviderType.MUSIC]: MusicSettings,
  [ProviderType.METADATA]: MetadataSettings,
  [ProviderType.AUDIO_ANALYSIS]: AudioAnalysis,
};

// the page the test opens, with what its route hands it
function mountPage(options: { global: MountingOptions<unknown>["global"] }) {
  const page = OWN_PAGES[pageType];
  return page
    ? shallowMount(page, options)
    : shallowMount(ProviderListSettings, {
        ...options,
        props: { type: pageType },
      });
}

// the key and target of each row leading to a page below the list
function linkRows(wrapper: Awaited<ReturnType<typeof mountWithLinks>>) {
  return wrapper.findAll('[data-testid^="settings-page-link-"]').map((row) => ({
    key: row.attributes("data-testid")!.replace("settings-page-link-", ""),
    to: JSON.parse(row.attributes("href")!),
  }));
}

// the list, title and count of each list on the page, in their order
function panels(wrapper: Awaited<ReturnType<typeof mountWithConfigs>>) {
  return wrapper.findAllComponents(SettingsListPanel).map((panel) => ({
    list: panel.attributes("data-list"),
    title: panel.props("title"),
    count: panel.props("count"),
  }));
}

// the sections of the list of the given type
function panelSections(
  wrapper: Awaited<ReturnType<typeof mountWithConfigs>>,
  list: string,
) {
  return wrapper
    .get(`[data-list="${list}"]`)
    .findAll('[data-testid="provider-section"]');
}

// the only row on a page that lists a single source
function onlyRow(wrapper: Awaited<ReturnType<typeof mountWithConfigs>>) {
  return wrapper.getComponent(ProviderRowStub);
}

// the row rendering a specific source, found by its instance id
function rowFor(
  wrapper: Awaited<ReturnType<typeof mountWithConfigs>>,
  instanceId: string,
) {
  const row = wrapper
    .findAllComponents(ProviderRowStub)
    .find((candidate) => candidate.props("config").instance_id === instanceId);
  if (!row) throw new Error(`no provider row for ${instanceId}`);
  return row;
}

// the menu button emits on the app-wide eventbus, which is what carries the items
async function openMenu(wrapper: Awaited<ReturnType<typeof mountWithConfigs>>) {
  onlyRow(wrapper).vm.$emit("menu", { clientX: 0, clientY: 0 });
  await flushPromises();
  const contextMenuCall = eventbusMock.emit.mock.calls.find(
    ([event]) => event === "contextmenu",
  );
  return contextMenuCall?.[1].items;
}
