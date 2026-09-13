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
  props: ["show", "providerType", "multiInstanceOnly"],
  template: `
    <div
      data-testid="add-dialog"
      :data-provider-type="providerType ?? ''"
      :data-multi-instance="String(multiInstanceOnly)"
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

const ItemStub = {
  name: "Item",
  emits: ["click"],
  template: `<div @click="$emit('click')"><slot /></div>`,
};

const SlotStub = {
  template: "<div><slot /></div>",
};

const ButtonStub = {
  emits: ["click"],
  template: `<button @click="$emit('click', $event)"><slot /></button>`,
};

beforeEach(() => {
  vi.clearAllMocks();
  apiMock.getAllUsers.mockResolvedValue([owner, member]);
  apiMock.getProvider.mockReturnValue(undefined);
  apiMock.getShareCandidates.mockResolvedValue(shareCandidates);
  apiMock.providerManifests.spotify.builtin = false;
  apiMock.providerManifests.spotify.has_setup_flow = true;
  apiMock.providerManifests.spotify.stage = ProviderStage.STABLE;
  apiMock.reloadProvider.mockResolvedValue(undefined);
  apiMock.subscribe.mockReturnValue(vi.fn());
  apiMock.supportsShareCandidates = true;
  authMock.hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.admin));
  routeMock.query.types = "music";
  storeMock.currentUser = owner;
});

describe("Providers", () => {
  it("opens reconfiguration when an authentication-required provider is clicked", async () => {
    const wrapper = await mountProviders(ProviderStatus.AUTH_REQUIRED);

    await wrapper.get('[data-testid="provider-row"]').trigger("click");

    expect(eventbusMock.emit).toHaveBeenCalledWith("setupFlowDialog", {
      kind: "reconfigure",
      instanceId: "spotify--test",
      onFlowEnded: expect.any(Function),
    });
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it("opens options when a provider with a generic error is clicked", async () => {
    const wrapper = await mountProviders(ProviderStatus.ERROR);

    await wrapper.get('[data-testid="provider-row"]').trigger("click");

    expect(routerMock.push).toHaveBeenCalledWith(
      "/settings/editprovider/spotify--test",
    );
    expect(eventbusMock.emit).not.toHaveBeenCalledWith(
      "setupFlowDialog",
      expect.anything(),
    );
  });

  it("opens options when an authentication-required provider has no setup flow", async () => {
    const wrapper = await mountProviders(ProviderStatus.AUTH_REQUIRED, false);

    await wrapper.get('[data-testid="provider-row"]').trigger("click");

    expect(routerMock.push).toHaveBeenCalledWith(
      "/settings/editprovider/spotify--test",
    );
    expect(wrapper.find('[data-testid="provider-action"]').exists()).toBe(
      false,
    );
  });

  it("starts reconfiguration from the provider warning action", async () => {
    const wrapper = await mountProviders(ProviderStatus.ERROR);

    await wrapper.get('[data-testid="provider-action"]').trigger("click");

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
    expect(wrapper.findAll('[data-testid="provider-row"]')).toHaveLength(0);
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
    expect(wrapper.findAll('[data-testid="provider-row"]')).toHaveLength(1);
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

    expect(wrapper.get('[data-testid="stage-badge"]').text()).toBe(
      "settings.stage.options.deprecated",
    );
  });

  it("hides the stage badge for a stable provider", async () => {
    const wrapper = await mountProviders(ProviderStatus.LOADED);

    expect(wrapper.find('[data-testid="stage-badge"]').exists()).toBe(false);
  });

  it("summarizes a music source without an access record as a household one", async () => {
    const wrapper = await mountProviders(ProviderStatus.LOADED);

    expect(wrapper.get('[data-testid="provider-access"]').text()).toBe(
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

    expect(wrapper.get('[data-testid="provider-access"]').text()).toBe(
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

    expect(wrapper.get('[data-testid="provider-access"]').text()).toBe(
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

      expect(wrapper.get('[data-testid="provider-access"]').text()).toBe(
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

    expect(wrapper.get('[data-testid="provider-access"]').text()).toBe(
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

    expect(wrapper.get('[data-testid="provider-access"]').text()).toBe(
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

    expect(wrapper.get('[data-testid="provider-access"]').text()).toBe(
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
    expect(wrapper.find('[data-testid="provider-access"]').exists()).toBe(
      false,
    );
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
    expect(wrapper.find('[data-testid="provider-access"]').exists()).toBe(
      false,
    );
  });

  it("leaves the offered provider types to the route for an admin", async () => {
    const wrapper = await mountProviders(ProviderStatus.LOADED);

    const dialog = wrapper.get('[data-testid="add-dialog"]');
    expect(dialog.attributes("data-provider-type")).toBe("");
    expect(dialog.attributes("data-multi-instance")).toBe("false");
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

  it("lists only the music sources it owns, whatever type the route asks for", async () => {
    routeMock.query.types = "player";

    const wrapper = await mountWithConfigs([
      ownSource(),
      otherSource(),
      playerProvider(),
    ]);

    const rows = wrapper.findAll('[data-testid="provider-row"]');
    expect(rows).toHaveLength(1);
    expect(rows[0].text()).toContain("Own Spotify");
  });

  it("summarizes its own source by the sharing alone", async () => {
    const wrapper = await mountWithConfigs([ownSource()]);

    expect(wrapper.get('[data-testid="provider-access"]').text()).toBe(
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

  it("offers only music sources that allow another account", async () => {
    const wrapper = await mountWithConfigs([ownSource()]);

    const dialog = wrapper.get('[data-testid="add-dialog"]');
    expect(dialog.attributes("data-provider-type")).toBe("music");
    expect(dialog.attributes("data-multi-instance")).toBe("true");
  });

  it("invites a member without sources to add one", async () => {
    const wrapper = await mountWithConfigs([otherSource()]);

    expect(wrapper.get('[data-testid="music-sources-empty"]').text()).toContain(
      "settings.music_sources_empty_title",
    );
    expect(wrapper.find('[data-testid="add-provider"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="add-provider-empty"]').exists()).toBe(
      true,
    );
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

function playerProvider() {
  return providerConfig({
    domain: "spotify",
    instance_id: "spotify--player",
    name: "Spotify Connect",
    status: ProviderStatus.LOADED,
    type: ProviderType.PLAYER,
  });
}

describe("Providers keyboard", () => {
  it("opens a provider from its name, the row's focusable control", async () => {
    const wrapper = await mountProviders(ProviderStatus.LOADED);

    const name = wrapper.get('[data-testid="provider-open"]');
    expect(name.element.tagName).toBe("BUTTON");
    await name.trigger("click");

    expect(routerMock.push).toHaveBeenCalledWith(
      "/settings/editprovider/spotify--test",
    );
    // the row only follows the pointer, so its buttons are not nested in a control
    expect(wrapper.get('[data-testid="provider-row"]').attributes("role")).toBe(
      undefined,
    );
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

    expect(wrapper.get('[data-testid="provider-status"]').text()).toBe(
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

    expect(wrapper.findAll('[data-testid="provider-row"]')).toHaveLength(0);
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
          viewMode: ref<"list" | "card">("list"),
        },
      },
      stubs: {
        AddProviderDialog: AddDialogStub,
        Badge: SlotStub,
        Container: SlotStub,
        Empty: SlotStub,
        EmptyContent: SlotStub,
        EmptyDescription: SlotStub,
        EmptyMedia: SlotStub,
        EmptyTitle: SlotStub,
        Item: ItemStub,
        ItemActions: SlotStub,
        ItemContent: SlotStub,
        ItemDescription: SlotStub,
        ItemGroup: SlotStub,
        ItemMedia: SlotStub,
        ItemTitle: SlotStub,
        ProviderAccessDialog: AccessDialogStub,
        Button: ButtonStub,
      },
    },
  });
  await flushPromises();
  return wrapper;
}

// the menu button emits on the app-wide eventbus, which is what carries the items
async function openMenu(wrapper: Awaited<ReturnType<typeof mountWithConfigs>>) {
  await wrapper.get('[data-testid="provider-menu"]').trigger("click");
  const contextMenuCall = eventbusMock.emit.mock.calls.find(
    ([event]) => event === "contextmenu",
  );
  return contextMenuCall?.[1].items;
}
