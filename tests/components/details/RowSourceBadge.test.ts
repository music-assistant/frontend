import RowSourceBadge from "@/components/details/RowSourceBadge.vue";
import type { SourceOption } from "@/components/details/rowRegistry";
import { mount, VueWrapper } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

const { passthrough } = vi.hoisted(() => ({
  passthrough: { template: "<div><slot /></div>" },
}));

vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

vi.mock("@/components/ui/badge", () => ({ Badge: passthrough }));

vi.mock("@/components/ProviderIcon.vue", () => ({
  default: { props: ["domain"], template: "<i :data-domain='domain' />" },
}));

// the radio items report the sources on offer and select through their group,
// mirroring the reka dropdown without its portal
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: passthrough,
  DropdownMenuTrigger: passthrough,
  DropdownMenuContent: passthrough,
  DropdownMenuRadioGroup: {
    props: ["modelValue"],
    emits: ["update:modelValue"],
    provide() {
      const group = this as unknown as {
        $emit: (event: string, value: string) => void;
      };
      return {
        pickSource: (value: string) => group.$emit("update:modelValue", value),
      };
    },
    template: "<div :data-current='modelValue'><slot /></div>",
  },
  DropdownMenuRadioItem: {
    props: ["value"],
    inject: ["pickSource"],
    template:
      "<button :data-source='value' @click='pickSource(value)'><slot /></button>",
  },
}));

const LIBRARY_AND_SPOTIFY: SourceOption[] = [
  { value: "library", label: "Your library" },
  { value: "spotify--1", label: "Spotify", domain: "spotify" },
];

function mountBadge(props: InstanceType<typeof RowSourceBadge>["$props"]) {
  return mount(RowSourceBadge, { props });
}

function sources(wrapper: VueWrapper) {
  return wrapper
    .findAll("[data-source]")
    .map((item) => item.attributes("data-source"));
}

describe("RowSourceBadge", () => {
  it("opens a picker and emits the chosen source when more than one is offered", async () => {
    const wrapper = mountBadge({
      label: "In your library",
      options: LIBRARY_AND_SPOTIFY,
      selected: "library",
    });

    expect(wrapper.text()).toContain("In your library");
    expect(sources(wrapper)).toEqual(["library", "spotify--1"]);
    expect(wrapper.get("[data-current]").attributes("data-current")).toBe(
      "library",
    );

    await wrapper.get('[data-source="spotify--1"]').trigger("click");
    expect(wrapper.emitted("select")).toEqual([["spotify--1"]]);
  });

  it("stays a plain label when only one source is offered", () => {
    const wrapper = mountBadge({
      label: "All sources",
      options: [{ value: "all", label: "All sources" }],
    });

    expect(sources(wrapper)).toEqual([]);
    expect(wrapper.text()).toContain("All sources");
  });

  it("stays a plain label when no sources are offered", () => {
    const wrapper = mountBadge({ label: "On Spotify", domain: "spotify" });

    expect(sources(wrapper)).toEqual([]);
    expect(wrapper.text()).toContain("On Spotify");
    expect(wrapper.find("[data-domain='spotify']").exists()).toBe(true);
  });
});
