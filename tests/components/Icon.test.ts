import Icon from "@/components/Icon.vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

const stubs = {
  VIcon: { template: "<i><slot /></i>" },
  VBadge: { template: "<div><slot /></div>" },
};

const mountButton = () =>
  mount(Icon, {
    props: {
      variant: "button",
      ariaLabel: "Toggle playback",
    },
    global: { stubs },
  });

describe("Icon button", () => {
  it("does not activate repeatedly when Enter is held", async () => {
    const wrapper = mountButton();
    const button = wrapper.get('[role="button"]');

    await button.trigger("keydown.enter", { repeat: false });
    await button.trigger("keydown.enter", { repeat: true });

    expect(wrapper.emitted("click")).toHaveLength(1);
  });

  it("activates once on Space keyup", async () => {
    const wrapper = mountButton();
    const button = wrapper.get('[role="button"]');

    await button.trigger("keydown.space");
    expect(wrapper.emitted("click")).toBeUndefined();

    await button.trigger("keyup.space");

    expect(wrapper.emitted("click")).toHaveLength(1);
  });
});
