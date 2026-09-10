import {
  enableAutoUnmount,
  flushPromises,
  mount,
  type VueWrapper,
} from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EventType,
  type ProviderConfig,
  ProviderSharing,
  ProviderStatus,
  ProviderType,
  type User,
} from "@/plugins/api/interfaces";
import type { MusicAssistantApi } from "@/plugins/api";
import MyMusicSources from "@/views/settings/MyMusicSources.vue";
import { providerConfig } from "../fixtures/providerConfig";
import { providerManifest } from "../fixtures/providerManifest";
import { user } from "../fixtures/user";

const {
  apiMock,
  eventbusMock,
  routerMock,
  storeMock,
  toastMock,
  unsubscribeMock,
} = vi.hoisted(() => ({
  apiMock: {
    getProviderConfigs: vi.fn<MusicAssistantApi["getProviderConfigs"]>(),
    providerManifests: {} as Record<string, unknown>,
    providers: {},
    reloadProvider: vi.fn<MusicAssistantApi["reloadProvider"]>(),
    removeProviderConfig: vi.fn<MusicAssistantApi["removeProviderConfig"]>(),
    subscribe: vi.fn(),
  },
  eventbusMock: {
    emit: vi.fn(),
  },
  routerMock: {
    push: vi.fn(),
  },
  storeMock: {
    currentUser: undefined as User | undefined,
  },
  toastMock: {
    error: vi.fn(),
    success: vi.fn(),
  },
  unsubscribeMock: vi.fn(),
}));

vi.mock("@/plugins/api", () => ({
  api: apiMock,
  default: apiMock,
}));

vi.mock("@/plugins/eventbus", () => ({
  eventbus: eventbusMock,
}));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

vi.mock("@/plugins/store", () => ({
  store: storeMock,
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

let providersUpdated: (() => void) | undefined;

const SlotStub = {
  template: "<div><slot /></div>",
};

// the real dropdown only renders its items while open, so the menu is flattened
// and the dialogs are reduced to the props the page hands them
const AddProviderDialogStub = {
  name: "AddProviderDialog",
  props: { show: Boolean, providerType: String, multiInstanceOnly: Boolean },
  template: "<div />",
};

const ProviderAccessDialogStub = {
  name: "ProviderAccessDialog",
  props: { open: Boolean, config: Object, users: Array },
  template: "<div />",
};

enableAutoUnmount(afterEach);

beforeEach(() => {
  vi.clearAllMocks();
  providersUpdated = undefined;
  storeMock.currentUser = user();
  apiMock.providerManifests = {
    spotify: providerManifest({
      domain: "spotify",
      name: "Spotify",
      has_setup_flow: true,
      multi_instance: true,
    }),
  };
  apiMock.reloadProvider.mockResolvedValue(undefined);
  apiMock.removeProviderConfig.mockResolvedValue(undefined);
  apiMock.subscribe.mockImplementation(
    (event: EventType, callback: () => void) => {
      if (event === EventType.PROVIDERS_UPDATED) {
        providersUpdated = callback;
      }
      return unsubscribeMock;
    },
  );
});

describe("MyMusicSources", () => {
  it("lists only the music sources owned by the current user", async () => {
    const wrapper = await mountPage([
      ownSource(),
      providerConfig({ domain: "tidal", instance_id: "tidal--household" }),
      providerConfig({
        domain: "qobuz",
        instance_id: "qobuz--other",
        access: {
          owner: "other-user",
          sharing: ProviderSharing.PRIVATE,
          shared_users: [],
        },
      }),
    ]);

    expect(apiMock.getProviderConfigs).toHaveBeenCalledWith(ProviderType.MUSIC);
    const sources = wrapper.findAll('[data-testid="music-source"]');
    expect(sources).toHaveLength(1);
    expect(sources[0].text()).toContain("Spotify");
    expect(wrapper.get('[data-testid="source-sharing"]').text()).toBe(
      "settings.source_access.options.private",
    );
  });

  it("lists the sources needing attention first", async () => {
    const wrapper = await mountPage([
      ownSource({ name: "Alpha" }),
      ownSource({
        instance_id: "spotify--broken",
        name: "Zulu",
        status: ProviderStatus.ERROR,
      }),
    ]);

    const names = wrapper
      .findAll('[data-testid="music-source"]')
      .map((source) => source.get('[data-testid="source-name"]').text());
    expect(names).toEqual(["Zulu", "Alpha"]);
  });

  it("shows the empty state when the user owns no source", async () => {
    const wrapper = await mountPage([
      providerConfig({ domain: "tidal", instance_id: "tidal--household" }),
    ]);

    expect(wrapper.findAll('[data-testid="music-source"]')).toHaveLength(0);
    expect(wrapper.get('[data-testid="music-sources-empty"]').text()).toContain(
      "settings.my_music_sources_empty_title",
    );
    expect(wrapper.find('[data-testid="add-source-empty"]').exists()).toBe(
      true,
    );
    // the empty state carries the only add button
    expect(wrapper.find('[data-testid="add-source"]').exists()).toBe(false);
  });

  it("names a source that is not loaded by its config", async () => {
    const wrapper = await mountPage([
      ownSource({
        name: null,
        default_name: "Spotify (sam)",
        status: ProviderStatus.DISABLED,
      }),
    ]);

    expect(wrapper.get('[data-testid="source-name"]').text()).toBe(
      "Spotify (sam)",
    );
  });

  it("opens the add dialog restricted to multi-instance music sources", async () => {
    const wrapper = await mountPage([ownSource()]);

    await wrapper.get('[data-testid="add-source"]').trigger("click");

    expect(wrapper.findComponent(AddProviderDialogStub).props()).toEqual({
      show: true,
      providerType: ProviderType.MUSIC,
      multiInstanceOnly: true,
    });
  });

  it("reloads a source from its menu", async () => {
    const wrapper = await mountPage([ownSource()]);

    await wrapper.get('[data-testid="source-reload"]').trigger("click");
    await flushPromises();

    expect(apiMock.reloadProvider).toHaveBeenCalledWith("spotify--own");
    expect(toastMock.success).toHaveBeenCalledWith(
      "settings.provider_reloading",
    );
  });

  it("removes a source once the confirmation is accepted", async () => {
    const wrapper = await mountPage([ownSource()]);

    await wrapper.get('[data-testid="source-remove"]').trigger("click");
    expect(apiMock.removeProviderConfig).not.toHaveBeenCalled();

    await emittedPayload("deleteConfirmationDialog").onConfirm();
    await flushPromises();

    expect(apiMock.removeProviderConfig).toHaveBeenCalledWith("spotify--own");
    expect(toastMock.success).toHaveBeenCalledWith("settings.provider_removed");
    expect(apiMock.getProviderConfigs).toHaveBeenCalledTimes(2);
  });

  it("opens the sharing dialog for the source it was started from", async () => {
    const config = ownSource();
    const wrapper = await mountPage([config]);

    await wrapper.get('[data-testid="source-share"]').trigger("click");

    // an owner may only set the sharing of its own source, so it gets no users
    expect(wrapper.findComponent(ProviderAccessDialogStub).props()).toEqual({
      open: true,
      config,
      users: null,
    });
  });

  it("starts the setup flow when a source is reconfigured", async () => {
    const wrapper = await mountPage([ownSource()]);

    await wrapper.get('[data-testid="source-reconfigure"]').trigger("click");

    expect(eventbusMock.emit).toHaveBeenCalledWith("setupFlowDialog", {
      kind: "reconfigure",
      instanceId: "spotify--own",
      onFlowEnded: expect.any(Function),
    });

    emittedPayload("setupFlowDialog").onFlowEnded(true);
    await flushPromises();
    expect(apiMock.getProviderConfigs).toHaveBeenCalledTimes(2);
  });

  it("opens the options page of a source", async () => {
    const wrapper = await mountPage([ownSource()]);

    await wrapper.get('[data-testid="source-options"]').trigger("click");

    expect(routerMock.push).toHaveBeenCalledWith(
      "/settings/editprovider/spotify--own",
    );
  });

  it("offers a direct fix for a source that lost its authentication", async () => {
    const wrapper = await mountPage([
      ownSource({
        status: ProviderStatus.AUTH_REQUIRED,
        last_error: { error_code: 1, message: "Authentication required" },
      }),
    ]);

    expect(wrapper.get('[data-testid="source-status"]').text()).toBe(
      "settings.provider_status_auth_required",
    );
    expect(wrapper.get('[data-testid="music-source"]').text()).toContain(
      "Authentication required",
    );
    expect(wrapper.find('[data-testid="source-fix"]').exists()).toBe(true);
  });

  it("reloads the list when the providers change", async () => {
    await mountPage([ownSource()]);
    expect(apiMock.getProviderConfigs).toHaveBeenCalledTimes(1);

    providersUpdated?.();
    await flushPromises();

    expect(apiMock.getProviderConfigs).toHaveBeenCalledTimes(2);
  });
});

/** A spotify source owned by the signed-in user. */
function ownSource(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return providerConfig({
    domain: "spotify",
    instance_id: "spotify--own",
    status: ProviderStatus.LOADED,
    access: {
      owner: "user-id",
      sharing: ProviderSharing.PRIVATE,
      shared_users: [],
    },
    ...overrides,
  });
}

function emittedPayload(event: string) {
  const call = eventbusMock.emit.mock.calls.find(([name]) => name === event);
  expect(call).toBeDefined();
  return call![1];
}

async function mountPage(configs: ProviderConfig[]): Promise<VueWrapper> {
  apiMock.getProviderConfigs.mockResolvedValue(configs);
  const wrapper = mount(MyMusicSources, {
    global: {
      mocks: {
        $t: (key: string) => key,
      },
      stubs: {
        AddProviderDialog: AddProviderDialogStub,
        Container: SlotStub,
        DropdownMenu: SlotStub,
        DropdownMenuContent: SlotStub,
        DropdownMenuItem: SlotStub,
        DropdownMenuSeparator: true,
        DropdownMenuTrigger: SlotStub,
        ProviderAccessDialog: ProviderAccessDialogStub,
        ProviderIcon: true,
      },
    },
  });
  await flushPromises();
  return wrapper;
}
