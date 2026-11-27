import DetailHeroTitle from "@/components/details/DetailHeroTitle.vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { artist } from "../../fixtures/artist";
import { track } from "../../fixtures/track";

describe("DetailHeroTitle", () => {
  it("adds the version after the name", () => {
    const wrapper = mount(DetailHeroTitle, {
      props: { item: track({ name: "Airbag", version: "Remastered" }) },
    });
    expect(wrapper.get("h1").text()).toContain("Airbag");
    expect(wrapper.get("h1").text()).toContain("(Remastered)");
  });

  // the pinned bar watches the h1, so a logo arriving must not replace it
  it("keeps the same h1 when a logo stands in for the name", async () => {
    const wrapper = mount(DetailHeroTitle, {
      props: { item: artist({ name: "Radiohead" }) },
    });
    const heading = wrapper.get("h1").element;

    await wrapper.setProps({ logo: "logo.png" });

    expect(wrapper.get("h1").element).toBe(heading);
    expect(wrapper.get("img").attributes("src")).toBe("logo.png");
    expect(wrapper.get("h1 .sr-only").text()).toBe("Radiohead");
  });
});
