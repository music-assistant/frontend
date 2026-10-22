import ProviderDetails from "@/components/ProviderDetails.vue";
import type { ContextMenuItem } from "@/helpers/context_menu_item";
import { mount } from "@vue/test-utils";
import type { DirectiveBinding } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { providerMapping } from "../fixtures/providerMapping";
import { radio } from "../fixtures/radio";

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
  const wrapper = mount(ProviderDetails, {
    props: {
      itemDetails: radio({
        provider: "test_provider",
        provider_mappings: [providerMapping(mappingOverrides)],
      }),
    },
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
