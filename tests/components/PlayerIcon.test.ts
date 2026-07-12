import PlayerIcon from "@/components/PlayerIcon.vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

describe("PlayerIcon", () => {
  it("renders saved MDI icons without a Vuetify component", () => {
    const wrapper = mount(PlayerIcon, {
      props: {
        icon: "mdi-speaker",
        size: 20,
      },
    });

    const icon = wrapper.find("i");
    expect(icon.classes()).toEqual(
      expect.arrayContaining(["mdi", "mdi-speaker"]),
    );
    expect(icon.attributes("style")).toContain("font-size: 20px");
  });
});
