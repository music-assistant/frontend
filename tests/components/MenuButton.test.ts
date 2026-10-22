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

  it("keeps the label rigid by default but shrinks and truncates when asked", () => {
    const fixed = mountButton({ text: "Play on the kitchen speaker" });
    const fixedPrimary = fixed.findAll("button")[0];
    expect(fixed.find(".truncate").exists()).toBe(false);
    expect(fixedPrimary.classes()).toContain("min-w-40");
    expect(fixedPrimary.classes()).not.toContain("shrink");

    const shrinking = mountButton({
      text: "Play on the kitchen speaker",
      truncate: true,
    });
    const shrinkingPrimary = shrinking.findAll("button")[0];
    const label = shrinking.find(".truncate");
    expect(label.exists()).toBe(true);
    expect(label.text()).toBe("Play on the kitchen speaker");
    // the primary action must override the button's own shrink-0 and drop its
    // min width so it can shrink all the way on a narrow row
    expect(shrinkingPrimary.classes()).toContain("shrink");
    expect(shrinkingPrimary.classes()).not.toContain("shrink-0");
    expect(shrinkingPrimary.classes()).not.toContain("min-w-40");
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
