import MenuButton from "@/components/MenuButton.vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

function mountButton(props: InstanceType<typeof MenuButton>["$props"] = {}) {
  return mount(MenuButton, {
    props,
    global: {
      mocks: {
        $t: (key: string) => key,
      },
    },
  });
}

describe("MenuButton", () => {
  it("renders the label on the primary action", () => {
    const wrapper = mountButton({ text: "Kitchen" });

    const primary = wrapper.findAll("button")[0];
    expect(primary.text()).toBe("Kitchen");
    expect(primary.find("svg").exists()).toBe(true);
  });

  it("emits click for the primary action and menu for the dropdown", async () => {
    const wrapper = mountButton({ text: "Play" });
    const [primary, menu] = wrapper.findAll("button");

    await primary.trigger("click");
    await menu.trigger("click");

    expect(wrapper.emitted("click")).toHaveLength(1);
    expect(wrapper.emitted("menu")).toHaveLength(1);
  });

  it("disables only the primary action when disabled", () => {
    const wrapper = mountButton({ text: "Play", disabled: true });
    const [primary, menu] = wrapper.findAll("button");

    expect(primary.attributes("disabled")).toBeDefined();
    expect(menu.attributes("disabled")).toBeUndefined();
  });

  it("shows a spinner and disables both actions while loading", () => {
    const wrapper = mountButton({ text: "Play", loading: true });
    const [primary, menu] = wrapper.findAll("button");

    expect(primary.attributes("disabled")).toBeDefined();
    expect(menu.attributes("disabled")).toBeDefined();
    expect(wrapper.find('[role="status"], .animate-spin').exists()).toBe(true);
  });
});
