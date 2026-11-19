import SettingsPageHeader from "@/components/settings/SettingsPageHeader.vue";
import About from "@/views/settings/About.vue";
import {
  enableAutoUnmount,
  flushPromises,
  shallowMount,
} from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    serverInfo: { value: undefined },
    getLibraryArtistsCount: vi.fn(async () => 0),
    getLibraryAlbumsCount: vi.fn(async () => 0),
    getLibraryTracksCount: vi.fn(async () => 0),
    getLibraryPlaylistsCount: vi.fn(async () => 0),
    getLibraryRadiosCount: vi.fn(async () => 0),
    getLibraryGenresCount: vi.fn(async () => 0),
  },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
vi.mock("@/plugins/auth", () => ({ authManager: { hasScope: () => true } }));
vi.mock("@/plugins/store", () => ({ store: {} }));
vi.mock("@/composables/useServerTime", () => ({
  useServerTime: () => ({ offsetSeconds: ref(null) }),
}));
vi.mock("vue-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-router")>()),
  useRouter: () => ({ push: vi.fn() }),
}));

enableAutoUnmount(afterEach);

describe("About", () => {
  it("heads the page with the header of About", async () => {
    const wrapper = shallowMount(About, {
      global: { mocks: { $t: (key: string) => key } },
    });
    await flushPromises();

    expect(wrapper.getComponent(SettingsPageHeader).props("page")).toBe(
      "about",
    );
  });
});
