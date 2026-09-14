import PlayerIcon from "@/components/PlayerIcon.vue";
import { makeSvgIcon } from "@/components/ma-icons/_make-icon";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

describe("PlayerIcon", () => {
  it("renders shared SVG artwork at the root", () => {
    const TestIcon = makeSvgIcon(
      "test-icon",
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><!-- source comment --><path fill="currentColor" d="M1 1h22v22H1z" /></svg>',
    );
    const wrapper = mount(TestIcon, {
      props: { size: 20 },
      attrs: { "aria-hidden": "true", class: "size-5" },
    });

    expect(wrapper.element.tagName).toBe("svg");
    expect(wrapper.attributes("width")).toBe("20");
    expect(wrapper.attributes("height")).toBe("20");
    expect(wrapper.attributes("class")).toBe("size-5");
    expect(wrapper.attributes("aria-hidden")).toBe("true");
    expect(wrapper.html()).not.toContain("source comment");
  });

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
