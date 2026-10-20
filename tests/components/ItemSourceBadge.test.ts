import ItemSourceBadge from "@/components/ItemSourceBadge.vue";
import type { Track } from "@/plugins/api/interfaces";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { providerMapping } from "../fixtures/providerMapping";
import { track } from "../fixtures/track";

const { copyMock, toastMock } = vi.hoisted(() => ({
  copyMock: vi.fn<(text: string) => Promise<boolean>>(),
  toastMock: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/plugins/api", () => ({
  api: { getProviderManifest: () => ({ name: "Spotify" }) },
}));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));
vi.mock("@/helpers/utils", () => ({ copyToClipboard: copyMock }));
vi.mock("vue-sonner", () => ({ toast: toastMock }));
vi.mock("@/components/ProviderIcon.vue", () => ({
  default: {
    name: "ProviderIcon",
    props: ["domain", "size"],
    template: "<div />",
  },
}));

const inLibrary = () =>
  track({
    provider_mappings: [providerMapping({ in_library: true })],
  });

const outsideLibrary = () =>
  track({
    provider: "spotify",
    provider_mappings: [providerMapping({ provider_domain: "spotify" })],
  });

function mountBadge(item: Track, libraryOnly = false) {
  return mount(ItemSourceBadge, {
    props: { item, size: 20, libraryOnly },
    global: { mocks: { $t: (key: string) => key } },
  });
}

describe("ItemSourceBadge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("copies the library URI when the library badge is clicked", async () => {
    copyMock.mockResolvedValue(true);
    const wrapper = mountBadge(inLibrary());

    await wrapper.get("button").trigger("click");
    await flushPromises();

    expect(copyMock).toHaveBeenCalledWith("library://track/1");
    expect(toastMock.success).toHaveBeenCalledWith("uri_copied");
  });

  it("reports a failed copy", async () => {
    copyMock.mockResolvedValue(false);
    const wrapper = mountBadge(inLibrary());

    await wrapper.get("button").trigger("click");
    await flushPromises();

    expect(toastMock.error).toHaveBeenCalledWith("uri_copy_failed");
  });

  it("shows the provider for an item outside the library", () => {
    const wrapper = mountBadge(outsideLibrary());

    expect(wrapper.find("button").exists()).toBe(false);
    expect(wrapper.get("[role='img']").attributes("title")).toBe("Spotify");
    expect(
      wrapper.findComponent({ name: "ProviderIcon" }).props("domain"),
    ).toBe("spotify");
  });

  it("shows nothing outside the library when limited to the library", () => {
    const wrapper = mountBadge(outsideLibrary(), true);

    expect(wrapper.find(".item-source-badge").exists()).toBe(false);
  });
});
