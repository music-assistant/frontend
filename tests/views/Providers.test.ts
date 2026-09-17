import { flushPromises, shallowMount } from "@vue/test-utils";
import { ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type ProviderConfig,
  ProviderSharing,
  ProviderStage,
  ProviderStatus,
  ProviderType,
  type Scope,
  type User,
  UserRole,
} from "@/plugins/api/interfaces";
import type { MusicAssistantApi } from "@/plugins/api";
import Providers from "@/views/settings/Providers.vue";
import { providerConfig } from "../fixtures/providerConfig";
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
  routeMock,
  routerMock,
  storeMock,
  toastMock,
} = vi.hoisted(() => ({
  apiMock: {
    getAllUsers: vi.fn<MusicAssistantApi["getAllUsers"]>(),
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
        self_service: true,
        stage: "stable",
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
    providers: {},
    reloadProvider: vi.fn<MusicAssistantApi["reloadProvider"]>(),
    removeProviderConfig: vi.fn<MusicAssistantApi["removeProviderConfig"]>(),
    saveProviderConfig: vi.fn<MusicAssistantApi["saveProviderConfig"]>(),
    startSync: vi.fn<MusicAssistantApi["startSync"]>(),
    subscribe: vi.fn(),
    supportsShareCandidates: true,
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
  routeMock: {
    query: { types: "music" },
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
const AddDialogStub = vi.hoisted(() => ({
  name: "AddProviderDialog",
  props: ["show", "providerType", "multiInstanceOnly", "selfServiceOnly"],
  template: `
    <div
      data-testid="add-dialog"
      :data-provider-type="providerType ?? ''"
      :data-multi-instance="String(multiInstanceOnly)"
      :data-self-service="String(selfServiceOnly)"
    />
  `,
}));

vi.mock("@/views/settings/AddProviderDialog.vue", () => ({
  default: AddDialogStub,
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
    useRoute: () => routeMock,
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
    "manageable",
    "reconfigurable",
    "syncing",
    "name",
    "description",
    "accessSummary",
    "statusVariant",
    "statusLabel",
    "isError",
    "errorText",
    "stageLabel",
  ],
  emits: ["open", "menu", "reconfigure"],
  template: `<div data-testid="provider-row">{{ name }}</div>`,
};

beforeEach(() => {
  vi.clearAllMocks();
  apiMock.getAllUsers.mockResolvedValue([owner, member]);
  apiMock.getProvider.mockReturnValue(undefined);
  apiMock.getShareCandidates.mockResolvedValue(shareCandidates);
  apiMock.providerManifests.spotify.builtin = false;
  apiMock.providerManifests.spotify.has_setup_flow = true;
  apiMock.providerManifests.spotify.self_service = true;
  apiMock.providerManifests.spotify.stage = ProviderStage.STABLE;
  apiMock.reloadProvider.mockResolvedValue(undefined);
  apiMock.subscribe.mockReturnValue(vi.fn());
  apiMock.supportsShareCandidates = true;
  authMock.hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.admin));
  routeMock.query.types = "music";
  storeMock.currentUser = owner;
});

describe("Providers", () => {
  it("opens reconfiguration when an authentication-required provider is activated", async () => {
    const wrapper = await mountProviders(ProviderStatus.AUTH_REQUIRED);

    onlyRow(wrapper).vm.$emit("open");

    expect(eventbusMock.emit).toHaveBeenCalledWith("setupFlowDialog", {
      kind: "reconfigure",
      instanceId: "spotify--test",
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
    expect(removeCall?.[1].message).toBe("settings.remove_provider_confirm");
    // the stubbed $t returns the key, so the name is checked where it is passed
    expect(i18nMock.$t).toHaveBeenCalledWith(
      "settings.remove_provider_confirm",
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

  it("labels the stage badge from the translated stage key", async () => {
    apiMock.providerManifests.spotify.stage = ProviderStage.DEPRECATED;

    const wrapper = await mountProviders(ProviderStatus.LOADED);

    expect(onlyRow(wrapper).props("stageLabel")).toBe(
      "settings.stage.options.deprecated",
    );
  });

  it("hides the stage badge for a stable provider", async () => {
    const wrapper = await mountProviders(ProviderStatus.LOADED);

    expect(onlyRow(wrapper).props("stageLabel")).toBe("");
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
        access: { owner: null, shared_users: [], sharing },
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
    ).toBe("user-marcel,user-sam");
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
    routeMock.query.types = "player";

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

  it("leaves the offered provider types to the route for an admin", async () => {
    const wrapper = await mountProviders(ProviderStatus.LOADED);

    const dialog = wrapper.get('[data-testid="add-dialog"]');
    expect(dialog.attributes("data-provider-type")).toBe("");
    expect(dialog.attributes("data-multi-instance")).toBe("false");
    expect(dialog.attributes("data-self-service")).toBe("false");
  });

  it("offers reconfiguration of a provider that only an admin may set up", async () => {
    apiMock.providerManifests.spotify.self_service = false;

    const wrapper = await mountProviders(ProviderStatus.LOADED);

    const menuItems = await openMenu(wrapper);
    expect(menuItems[0].label).toBe("settings.reconfigure");
  });

  it("keeps the filter empty state for a provider type without any provider", async () => {
    routeMock.query.types = "player";

    const wrapper = await mountWithConfigs([]);

    expect(wrapper.find('[data-testid="music-sources-empty"]').exists()).toBe(
      false,
    );
    expect(wrapper.get(".empty-state").text()).toContain("no_content");
    expect(wrapper.find('[data-testid="add-provider"]').exists()).toBe(true);
  });

  it("keeps the provider that ships with the server listed", async () => {
    const wrapper = await mountWithConfigs([builtinSource()]);

    expect(wrapper.findAllComponents(ProviderRowStub)).toHaveLength(1);
  });

  it("lists every source in a single untitled section", async () => {
    const wrapper = await mountWithConfigs([ownSource(), otherSource()]);

    const sections = wrapper.findAll('[data-testid="provider-section"]');
    expect(sections).toHaveLength(1);
    expect(sections[0].find("h2").exists()).toBe(false);
    expect(sections[0].findAll('[data-testid="provider-row"]')).toHaveLength(2);
  });

  it("reports a failing user lookup", async () => {
    apiMock.getAllUsers.mockRejectedValue(new Error("no users"));

    await mountProviders(ProviderStatus.LOADED);

    expect(toastMock.error).toHaveBeenCalledWith("auth.users_load_failed");
  });
});

describe("Providers for a member", () => {
  beforeEach(() => {
    authMock.hasScope.mockImplementation(
      scopeChecker(BUILTIN_ROLE_SCOPES.user),
    );
  });

  it("lists the music sources it may use, whatever type the route asks for", async () => {
    routeMock.query.types = "player";

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
    expect(sections[0].get("h2").text()).toBe("settings.music_sources_own");
    expect(sections[1].get("h2").text()).toBe("settings.music_sources_shared");

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

  it("offers the member actions and hides the administrative ones", async () => {
    apiMock.getProvider.mockReturnValue({
      available: true,
      domain: "spotify",
      instance_id: "spotify--own",
      is_streaming_provider: true,
      name: "Own Spotify",
      supported_features: [],
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
      "settings.documentation",
      "settings.remove_provider",
      "settings.reload",
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

  it("does not ask an older server who it may share with", async () => {
    apiMock.supportsShareCandidates = false;

    const wrapper = await mountWithConfigs([ownSource()]);

    expect(apiMock.getShareCandidates).not.toHaveBeenCalled();
    expect(
      wrapper
        .get('[data-testid="access-dialog"]')
        .attributes("data-share-candidates"),
    ).toBe("none");
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

  it("offers only music sources that allow another account and that members may set up", async () => {
    const wrapper = await mountWithConfigs([ownSource()]);

    const dialog = wrapper.get('[data-testid="add-dialog"]');
    expect(dialog.attributes("data-provider-type")).toBe("music");
    expect(dialog.attributes("data-multi-instance")).toBe("true");
    expect(dialog.attributes("data-self-service")).toBe("true");
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

    expect(wrapper.get('[data-section="shared"]').get("h2").text()).toBe(
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
    expect(wrapper.find(".empty-state").exists()).toBe(false);
  });
});

describe("Providers loading", () => {
  it("narrows a member's load to the music sources", async () => {
    authMock.hasScope.mockImplementation(
      scopeChecker(BUILTIN_ROLE_SCOPES.user),
    );

    await mountWithConfigs([]);

    expect(apiMock.getProviderConfigs).toHaveBeenCalledWith(ProviderType.MUSIC);
  });

  it("gives a role that manages only its own music sources the member view", async () => {
    authMock.hasScope.mockImplementation(scopeChecker(OWN_SOURCES_ROLE_SCOPES));

    await mountWithConfigs([]);

    expect(apiMock.getProviderConfigs).toHaveBeenCalledWith(ProviderType.MUSIC);
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
    expect(onlyRow(wrapper).props("statusLabel")).toBe(
      "settings.provider_status_auth_required",
    );
  });

  it("shows no empty state until the providers are loaded", async () => {
    const wrapper = await mountWithConfigs(new Promise(() => {}));

    expect(wrapper.find('[data-testid="music-sources-empty"]').exists()).toBe(
      false,
    );
    expect(wrapper.find(".empty-state").exists()).toBe(false);
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
    expect(wrapper.find(".empty-state").exists()).toBe(true);
  });
});

function ownSource() {
  return providerConfig({
    access: {
      owner: owner.user_id,
      shared_users: [],
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
) {
  apiMock.getProviderConfigs.mockReturnValue(Promise.resolve(configs));

  const wrapper = shallowMount(Providers, {
    global: {
      mocks: {
        $t: (key: string) => key,
      },
      provide: {
        providersViewMode: {
          toggleViewMode: vi.fn(),
          viewMode: ref<"list" | "card">(viewMode),
        },
      },
      stubs: {
        AddProviderDialog: AddDialogStub,
        Button: ButtonStub,
        Container: SlotStub,
        Empty: SlotStub,
        EmptyContent: SlotStub,
        EmptyDescription: SlotStub,
        EmptyMedia: SlotStub,
        EmptyTitle: SlotStub,
        ItemGroup: SlotStub,
        ProviderAccessDialog: AccessDialogStub,
        ProviderRow: ProviderRowStub,
        "v-icon": true,
      },
    },
  });
  await flushPromises();
  return wrapper;
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
