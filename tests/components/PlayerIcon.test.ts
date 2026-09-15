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
    expect(wrapper.find("path").exists()).toBe(true);
  });

  it("accepts leading whitespace like the upstream validator", () => {
    const TestIcon = makeSvgIcon(
      "test-icon",
      '\n  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M1 1h22v22H1z" /></svg>\n',
    );
    const wrapper = mount(TestIcon);

    expect(wrapper.element.tagName).toBe("svg");
    expect(wrapper.find("path").exists()).toBe(true);
  });

  it("uses the default size and preserves SVG attributes", () => {
    const TestIcon = makeSvgIcon(
      "test-icon",
      '<svg xmlns="http://www.w3.org/2000/svg" width="99" height="98" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 1h22v22H1z" /></svg>',
    );
    const wrapper = mount(TestIcon);

    expect(wrapper.attributes("width")).toBe("24");
    expect(wrapper.attributes("height")).toBe("24");
    expect(wrapper.attributes("viewBox")).toBe("0 0 24 24");
    expect(wrapper.attributes("fill")).toBe("none");
    expect(wrapper.attributes("stroke")).toBe("currentColor");
    expect(wrapper.attributes("stroke-width")).toBe("2");
  });

  it("accepts string sizes and overrides source dimensions", () => {
    const TestIcon = makeSvgIcon(
      "test-icon",
      '<svg width="24" height="24" viewBox="0 0 24 24"><path d="M1 1h22v22H1z" /></svg>',
    );
    const wrapper = mount(TestIcon, { props: { size: "1em" } });

    expect(wrapper.attributes("width")).toBe("1em");
    expect(wrapper.attributes("height")).toBe("1em");
  });

  it("rejects malformed SVG input", () => {
    expect(() => makeSvgIcon("broken-icon", "not an svg")).toThrow(
      'Invalid SVG for shared icon "broken-icon"',
    );
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
