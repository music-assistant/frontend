import { GroupedPlayers } from "@/components/ma-icons";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

describe("GroupedPlayers", () => {
  it("renders overlapping speaker cabinets", () => {
    const wrapper = mount(GroupedPlayers, {
      props: { size: 32, strokeWidth: 1.6 },
    });
    const svg = wrapper.get("svg");

    expect(svg.attributes("width")).toBe("32");
    expect(svg.attributes("stroke-width")).toBe("1.6");
    expect(wrapper.findAll("rect")).toHaveLength(1);
    expect(wrapper.findAll("circle")).toHaveLength(3);
  });
});
