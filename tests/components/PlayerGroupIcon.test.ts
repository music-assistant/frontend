import PlayerGroupIcon from "@/components/PlayerGroupIcon.vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

describe("PlayerGroupIcon", () => {
  it("shows the member count on the badge", () => {
    const wrapper = mount(PlayerGroupIcon, { props: { count: 4 } });

    expect(wrapper.get("[data-player-group-count]").text()).toBe("4");
  });

  it("draws the speaker with the shared stroke weight", () => {
    const wrapper = mount(PlayerGroupIcon, { props: { count: 2 } });

    expect(wrapper.get("svg").attributes("stroke-width")).toBe("1.4");
  });

  it("sizes the speaker glyph rather than the badge wrapper", () => {
    const wrapper = mount(PlayerGroupIcon, {
      props: { count: 2 },
      attrs: { class: "size-7" },
    });

    // the badge is anchored to the wrapper, so a caller's size must not land
    // on it or the count would be positioned against the wrong box
    expect(wrapper.get("svg").classes()).toContain("size-7");
    expect(wrapper.element.classList.contains("size-7")).toBe(false);
  });
});
