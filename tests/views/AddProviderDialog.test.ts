import AddProviderDialog from "@/views/settings/AddProviderDialog.vue";
import {
  enableAutoUnmount,
  flushPromises,
  mount,
  type VueWrapper,
} from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderStage, ProviderType } from "@/plugins/api/interfaces";
import { providerManifest } from "../fixtures/providerManifest";

const { apiMock, routeMock, storeMock } = vi.hoisted(() => ({
  apiMock: {
    providerManifests: {} as Record<string, unknown>,
    providers: {},
    getProviderConfigs: vi.fn(),
    getProvider: vi.fn(),
    getProviderName: vi.fn(),
  },
  routeMock: {
    query: {} as Record<string, string>,
  },
  storeMock: {
    isTouchscreen: false,
    dialogActive: false,
  },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
vi.mock("@/plugins/store", () => ({ store: storeMock }));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));
vi.mock("vue-router", () => ({ useRoute: () => routeMock }));

// an open dialog keeps document-level focus trap listeners, so tear it down
// even when an assertion fails
enableAutoUnmount(afterEach);

beforeEach(() => {
  vi.clearAllMocks();
  routeMock.query = {};
  storeMock.isTouchscreen = false;
  storeMock.dialogActive = false;
  apiMock.getProviderConfigs.mockResolvedValue([]);
  apiMock.providerManifests = {
    spotify: providerManifest({ domain: "spotify", name: "Spotify" }),
  };
  document.body.innerHTML = "";
});

describe("AddProviderDialog", () => {
  it("focuses the search field on a non-touch device", async () => {
    await openDialog();

    expect(document.activeElement).toBe(searchField());
  });

  it("leaves the search field alone on a touch device", async () => {
    storeMock.isTouchscreen = true;

    await openDialog();

    // focusing the search field would open the on-screen keyboard over the
    // provider list, so the dialog itself takes focus instead
    expect(document.activeElement).not.toBe(searchField());
    expect(document.activeElement).toBe(
      document.querySelector("[data-slot='dialog-content']"),
    );
  });

  it("labels the stage badge from the translated stage key", async () => {
    apiMock.providerManifests = {
      soundcloud: providerManifest({
        domain: "soundcloud",
        name: "SoundCloud",
        stage: ProviderStage.UNMAINTAINED,
      }),
    };

    await openDialog();

    expect(document.querySelector("[data-slot='badge']")?.textContent).toBe(
      "settings.stage.options.unmaintained",
    );
  });

  it("omits a deprecated provider from the list", async () => {
    apiMock.providerManifests = {
      local_audio: providerManifest({
        domain: "local_audio",
        name: "Local Audio Out",
        stage: ProviderStage.DEPRECATED,
      }),
      spotify: providerManifest({ domain: "spotify", name: "Spotify" }),
    };

    await openDialog();

    // a retired provider can no longer be set up, so it must not be offered
    expect(providerNames()).toEqual(["Spotify"]);
  });

  it("omits the stage badge for a stable provider", async () => {
    // stable is the norm, so a badge would be noise on nearly every row
    await openDialog();

    expect(document.querySelector("[data-slot='badge']")).toBeNull();
  });

  it("omits the stage badge for a manifest without a stage", async () => {
    apiMock.providerManifests = {
      spotify: providerManifest({
        domain: "spotify",
        name: "Spotify",
        stage: undefined as unknown as ProviderStage,
      }),
    };

    await openDialog();

    expect(document.querySelector("[data-slot='badge']")).toBeNull();
  });

  it("prefers the provider type prop over the route query", async () => {
    routeMock.query = { types: ProviderType.PLAYER };
    apiMock.providerManifests = {
      sonos: providerManifest({
        domain: "sonos",
        name: "Sonos",
        type: ProviderType.PLAYER,
      }),
      spotify: providerManifest({ domain: "spotify", name: "Spotify" }),
    };

    await openDialog({ providerType: ProviderType.MUSIC });

    expect(
      document.querySelector("[data-slot='dialog-title']")?.textContent,
    ).toBe("settings.add_music_provider");
    expect(providerNames()).toEqual(["Spotify"]);
  });

  it("offers only multi-instance providers when restricted", async () => {
    apiMock.providerManifests = {
      filesystem_smb: providerManifest({
        domain: "filesystem_smb",
        name: "SMB share",
      }),
      spotify: providerManifest({
        domain: "spotify",
        name: "Spotify",
        multi_instance: true,
      }),
    };

    await openDialog({ multiInstanceOnly: true });

    expect(providerNames()).toEqual(["Spotify"]);
  });

  it("offers only providers that members may set up when restricted", async () => {
    apiMock.providerManifests = {
      filesystem_local: providerManifest({
        domain: "filesystem_local",
        name: "Local disk",
        multi_instance: true,
        self_service: false,
      }),
      spotify: providerManifest({
        domain: "spotify",
        name: "Spotify",
        multi_instance: true,
      }),
    };

    await openDialog({ multiInstanceOnly: true, selfServiceOnly: true });

    expect(providerNames()).toEqual(["Spotify"]);
  });
});

function searchField() {
  return document.querySelector("[data-slot='input-group-control']");
}

function providerNames() {
  return [...document.querySelectorAll(".provider-name")].map(
    (el) => el.textContent,
  );
}

async function openDialog(
  props: {
    providerType?: ProviderType;
    multiInstanceOnly?: boolean;
    selfServiceOnly?: boolean;
  } = {},
): Promise<VueWrapper> {
  const wrapper = mount(AddProviderDialog, {
    props: { ...props, show: false },
    attachTo: document.body,
    global: {
      mocks: { $t: (key: string) => key },
      stubs: {
        FacetedFilter: true,
        ProviderIcon: true,
      },
    },
  });
  await wrapper.setProps({ show: true });
  await flushPromises();
  return wrapper;
}
