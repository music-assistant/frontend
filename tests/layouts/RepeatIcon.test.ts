import RepeatIcon from "@/layouts/default/PlayerOSD/PlayerControlBtn/RepeatIcon.vue";
import { RepeatMode } from "@/plugins/api/interfaces";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

describe("RepeatIcon", () => {
  // off is struck through, repeat-one carries a "1"
  it.each([
    [RepeatMode.OFF, 3, true, false],
    [RepeatMode.ALL, 2, false, false],
    [RepeatMode.ONE, 3, false, true],
  ])("draws the %s mode", (mode, paths, struck, one) => {
    const wrapper = mount(RepeatIcon, { props: { mode, size: 20 } });
    const drawn = wrapper.findAll("path").map((x) => x.attributes("d"));

    expect(drawn).toHaveLength(paths);
    expect(drawn.includes("M3 3l18 18")).toBe(struck);
    expect(drawn.includes("M11 11l1 -1v4")).toBe(one);
    expect(wrapper.get("svg").attributes("width")).toBe("20");
  });
});
