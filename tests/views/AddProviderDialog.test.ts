import AddProviderDialog from "@/views/settings/AddProviderDialog.vue";
import {
  enableAutoUnmount,
  flushPromises,
  mount,
  type VueWrapper,
} from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderStage } from "@/plugins/api/interfaces";
import { providerManifest } from "../fixtures/providerManifest";

const { apiMock, storeMock } = vi.hoisted(() => ({
  apiMock: {
    providerManifests: {} as Record<string, unknown>,
    providers: {},
    getProviderConfigs: vi.fn(),
    getProvider: vi.fn(),
    getProviderName: vi.fn(),
  },
  storeMock: {
    isTouchscreen: false,
    dialogActive: false,
  },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
vi.mock("@/plugins/store", () => ({ store: storeMock }));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));
vi.mock("vue-router", () => ({ useRoute: () => ({ query: {} }) }));

// an open dialog keeps document-level focus trap listeners, so tear it down
// even when an assertion fails
enableAutoUnmount(afterEach);

beforeEach(() => {
  vi.clearAllMocks();
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
      local_audio: providerManifest({
        domain: "local_audio",
        name: "Local Audio Out",
        stage: ProviderStage.DEPRECATED,
      }),
    };

    await openDialog();

    expect(document.querySelector("[data-slot='badge']")?.textContent).toBe(
      "settings.stage.options.deprecated",
    );
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
});

function searchField() {
  return document.querySelector("[data-slot='input-group-control']");
}

async function openDialog(): Promise<VueWrapper> {
  const wrapper = mount(AddProviderDialog, {
    props: { show: false },
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
