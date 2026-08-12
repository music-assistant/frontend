import PlayerGroupIcon from "@/components/PlayerGroupIcon.vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

describe("PlayerGroupIcon", () => {
  it("shows the member count on the badge", () => {
    const wrapper = mount(PlayerGroupIcon, { props: { count: 4 } });

    expect(wrapper.get("[data-player-group-count]").text()).toBe("4");
  });

  it("sizes the speaker glyph rather than the badge wrapper", () => {
    const wrapper = mount(PlayerGroupIcon, {
      props: { count: 2 },
      attrs: { class: "size-7", strokeWidth: 1.4 },
    });
    const svg = wrapper.get("svg");

    // the badge is anchored to the wrapper, so caller attributes must not
    // land on it or the count would be positioned against the wrong box
    expect(svg.classes()).toContain("size-7");
    expect(svg.attributes("stroke-width")).toBe("1.4");
    expect(wrapper.element.classList.contains("size-7")).toBe(false);
  });
});
