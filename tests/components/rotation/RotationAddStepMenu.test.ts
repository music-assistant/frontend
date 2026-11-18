import RotationAddStepMenu from "@/components/rotation/RotationAddStepMenu.vue";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

// the menu rendered in place, so its items can be selected
vi.mock("@/components/ui/dropdown-menu", () => {
  const passthrough = { template: "<div><slot /></div>" };
  return {
    DropdownMenu: passthrough,
    DropdownMenuTrigger: passthrough,
    DropdownMenuContent: passthrough,
    DropdownMenuItem: {
      emits: ["select"],
      template:
        '<button type="button" role="menuitem" @click="$emit(\'select\')"><slot /></button>',
    },
  };
});

enableAutoUnmount(afterEach);

function items(wrapper: ReturnType<typeof mount>) {
  return wrapper.findAll('[role="menuitem"]');
}

describe("RotationAddStepMenu", () => {
  it("offers each artist's albums and each artist's tracks from an artist list", async () => {
    const wrapper = mount(RotationAddStepMenu, {
      props: { allowed: ["filter", "expand"], kind: "artist" },
    });
    const labels = items(wrapper).map((item) => item.text());
    expect(
      labels.some((text) => text.includes("Play each artist's albums")),
    ).toBe(true);
    expect(
      labels.some((text) => text.includes("Play each artist's tracks")),
    ).toBe(true);

    const tracks = items(wrapper).find((item) =>
      item.text().includes("Play each artist's tracks"),
    )!;
    await tracks.trigger("click");
    expect(wrapper.emitted("add")).toEqual([["expand", "track"]]);
  });

  it("offers one expand entry from an album list", async () => {
    const wrapper = mount(RotationAddStepMenu, {
      props: { allowed: ["filter", "expand"], kind: "album" },
    });
    expect(items(wrapper)).toHaveLength(2);
    await items(wrapper)[1]!.trigger("click");
    expect(wrapper.emitted("add")).toEqual([["expand", undefined]]);
  });
});
