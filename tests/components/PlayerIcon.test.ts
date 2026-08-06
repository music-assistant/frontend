import PlayerIcon from "@/components/PlayerIcon.vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

describe("PlayerIcon", () => {
  it("renders a canonical id as its SVG icon", () => {
    const wrapper = mount(PlayerIcon, {
      props: { icon: "tv", size: 20 },
    });
    const svg = wrapper.find("svg");
    expect(svg.exists()).toBe(true);
    expect(svg.attributes("width")).toBe("20");
  });

  it("renders custom MA icons", () => {
    const wrapper = mount(PlayerIcon, {
      props: { icon: "homepod-mini", size: 24 },
    });
    expect(wrapper.find("svg").exists()).toBe(true);
  });

  it("falls back to the speaker icon for unknown values", () => {
    for (const icon of ["mdi-speaker", "some-unknown-id", null]) {
      const wrapper = mount(PlayerIcon, {
        props: { icon, size: 20 },
      });
      const svg = wrapper.find("svg");
      expect(svg.exists(), `value "${icon}" must render the fallback`).toBe(
        true,
      );
    }
  });

  it("renders the speaker-group icon when grouped", () => {
    const wrapper = mount(PlayerIcon, {
      props: { icon: "tv", grouped: true, size: 20 },
    });
    // the custom Speakers icon draws two cabinets (2 rects + 2 circles)
    expect(wrapper.findAll("rect").length).toBe(2);
    expect(wrapper.findAll("circle").length).toBe(2);
  });
});
