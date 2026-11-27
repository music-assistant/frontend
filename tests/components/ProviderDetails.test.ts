import ProviderDetails from "@/components/ProviderDetails.vue";
import type { ContextMenuItem } from "@/helpers/context_menu_item";
import type { MediaItem, ProviderMapping } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { mount } from "@vue/test-utils";
import type { DirectiveBinding } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { audioFormat } from "../fixtures/audioFormat";
import { providerMapping } from "../fixtures/providerMapping";
import { radio } from "../fixtures/radio";
import { track } from "../fixtures/track";
import { user } from "../fixtures/user";

const { emitEvent, copyToClipboard } = vi.hoisted(() => ({
  emitEvent: vi.fn(),
  copyToClipboard: vi.fn(),
}));

vi.mock("@/plugins/api", async () => {
  const { ref } = await import("vue");
  const { providerInstance } = await import("../fixtures/providerInstance");
  return {
    api: {
      getProvider: () => providerInstance(),
      getProviderManifest: () => undefined,
      providers: {},
      hasStreamingProviders: ref(false),
    },
  };
});

vi.mock("@/plugins/auth", () => ({
  authManager: { hasScope: () => false },
}));

vi.mock("@/plugins/eventbus", () => ({
  eventbus: { emit: emitEvent },
}));

vi.mock("@/helpers/utils", () => ({ copyToClipboard }));

// a wide screen, which has room for the sample button
vi.mock("@/plugins/breakpoint", () => ({ getBreakpointValue: () => true }));

vi.mock("vue-sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("vue-i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-i18n")>()),
  useI18n: () => ({ t: (key: string) => key }),
}));

const ToolbarStub = { emits: ["title-clicked"], template: "<div />" };

// the long-press directive is registered by a plugin the test skips, so a
// stand-in captures the handler bound to the first row
let holdHandler: (event: Event) => void;

async function mountDetails(mappingOverrides = {}) {
  return await mountItem(
    radio({
      provider: "test_provider",
      provider_mappings: [providerMapping(mappingOverrides)],
    }),
  );
}

async function mountItem(itemDetails: MediaItem) {
  const wrapper = mount(ProviderDetails, {
    props: { itemDetails },
    global: {
      mocks: { $t: (key: string) => key },
      directives: {
        hold: {
          mounted: (_el: Element, binding: DirectiveBinding) => {
            holdHandler ??= binding.value;
          },
        },
      },
      stubs: {
        Container: { template: "<div><slot /></div>" },
        GenreExclusionManager: true,
        ProviderIcon: true,
        Toolbar: ToolbarStub,
      },
    },
  });
  wrapper.findComponent(ToolbarStub).vm.$emit("title-clicked");
  await wrapper.vm.$nextTick();
  return wrapper;
}

function openedMenuItems(): ContextMenuItem[] {
  const call = emitEvent.mock.calls.find(([name]) => name === "contextmenu");
  return call?.[1].items ?? [];
}

describe("ProviderDetails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    holdHandler = undefined!;
  });

  it("opens the long-press menu for the mapping the row shows now", async () => {
    const wrapper = await mountDetails();
    await wrapper.setProps({
      itemDetails: radio({
        provider: "test_provider",
        provider_mappings: [providerMapping({ item_id: "item-2" })],
      }),
    });

    holdHandler(new Event("touchstart"));
    openedMenuItems()[0].action!();

    expect(copyToClipboard).toHaveBeenCalledWith(
      "test_provider--1://radio/item-2",
    );
  });

  it("keeps an unavailable source closed to long-press and the keyboard", async () => {
    const wrapper = await mountDetails({ available: false });

    holdHandler(new Event("touchstart"));

    expect(openedMenuItems()).toEqual([]);
    expect(
      wrapper.get('[aria-label^="more_options"]').attributes("disabled"),
    ).toBeDefined();
  });
});

describe("the sources of a track", () => {
  // a streaming source with a page of its own, in hi-res and in the library
  const streaming = providerMapping({
    url: "https://music.example/track/1",
    in_library: true,
    audio_format: audioFormat({ sample_rate: 96000, bit_depth: 24 }),
  });

  let open: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    holdHandler = undefined!;
    open = vi.spyOn(window, "open").mockImplementation(() => null);
  });

  afterEach(() => {
    store.currentUser = undefined;
    open.mockRestore();
  });

  const mountTrack = (mapping: ProviderMapping = streaming) =>
    mountItem(
      track({ provider: "test_provider", provider_mappings: [mapping] }),
    );
  const row = (wrapper: Awaited<ReturnType<typeof mountTrack>>) =>
    wrapper.get('[data-slot="item"]');

  describe("in the standard experience", () => {
    it("shows the source without its technical details", async () => {
      const wrapper = await mountTrack();

      // the library badge and the hi-res icon
      expect(
        row(wrapper).find('[title="tooltip.in_provider_library"]').exists(),
      ).toBe(true);
      expect(row(wrapper).find("img").exists()).toBe(true);
      expect(row(wrapper).text()).not.toContain("kHz");
      expect(row(wrapper).text()).not.toContain("test_provider--1://");
      expect(wrapper.find('[aria-label="tooltip.play_sample"]').exists()).toBe(
        false,
      );
      expect(wrapper.find('[aria-label^="more_options"]').exists()).toBe(true);
    });

    it("opens the source's page from its row", async () => {
      const wrapper = await mountTrack();

      await row(wrapper).trigger("click");

      expect(open).toHaveBeenCalledWith(streaming.url, "_blank");
    });

    it("keeps the row of a local file closed to a click", async () => {
      const wrapper = await mountTrack(
        providerMapping({
          provider_domain: "filesystem_local",
          url: "file:///music/track.flac",
        }),
      );

      await row(wrapper).trigger("click");

      expect(open).not.toHaveBeenCalled();
    });

    it("opens the menu, not the page, from the menu button", async () => {
      const wrapper = await mountTrack();

      await wrapper.get('[aria-label^="more_options"]').trigger("click");

      expect(open).not.toHaveBeenCalled();
      expect(openedMenuItems()).not.toEqual([]);
    });

    it("opens only the menu on a long-press", async () => {
      const wrapper = await mountTrack();

      await row(wrapper).trigger("touchstart");
      holdHandler(new Event("touchstart"));
      await row(wrapper).trigger("click");

      expect(openedMenuItems()).not.toEqual([]);
      expect(open).not.toHaveBeenCalled();
    });
  });

  describe("in the expert experience", () => {
    beforeEach(() => {
      store.currentUser = user({ preferences: { expert_mode: true } });
    });

    it("shows the technical details and the sample button", async () => {
      const wrapper = await mountTrack();

      expect(row(wrapper).text()).toContain("96kHz/24");
      expect(row(wrapper).text()).toContain("test_provider--1://track/item-1");
      expect(wrapper.find('[aria-label="tooltip.play_sample"]').exists()).toBe(
        true,
      );
    });

    it("opens the source's page from its link, not from its row", async () => {
      const wrapper = await mountTrack();

      await row(wrapper).trigger("click");
      expect(open).not.toHaveBeenCalled();

      await row(wrapper).get("a").trigger("click");
      expect(open).toHaveBeenCalledWith(streaming.url, "_blank");
    });
  });
});
