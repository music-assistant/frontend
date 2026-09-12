import { Button } from "@/components/ui/button";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

function mountButton(props: InstanceType<typeof Button>["$props"] = {}) {
  return mount(Button, {
    props,
    slots: { default: "Save" },
  });
}

describe("Button", () => {
  it("shows a spinner before the label, disables and marks busy while loading", () => {
    const button = mountButton({ loading: true });

    expect(button.element.firstElementChild?.getAttribute("role")).toBe(
      "status",
    );
    expect(button.text()).toBe("Save");
    expect(button.attributes("disabled")).toBeDefined();
    expect(button.attributes("aria-busy")).toBe("true");
    expect(button.attributes("loading")).toBeUndefined();
  });

  it("stays disabled while loading even when disabled is false", () => {
    const button = mountButton({ loading: true, disabled: false });

    expect(button.attributes("disabled")).toBeDefined();
  });

  it("shows no spinner and is neither disabled nor busy when idle", () => {
    const button = mountButton();

    expect(button.find('[role="status"]').exists()).toBe(false);
    expect(button.attributes("disabled")).toBeUndefined();
    expect(button.attributes("aria-busy")).toBeUndefined();
  });

  it("disables without a spinner when only disabled", () => {
    const button = mountButton({ disabled: true });

    expect(button.attributes("disabled")).toBeDefined();
    expect(button.find('[role="status"]').exists()).toBe(false);
  });

  it("hands its classes to the child element with as-child", () => {
    const wrapper = mount(Button, {
      props: { asChild: true },
      slots: { default: '<a href="/settings">Settings</a>' },
    });
    const link = wrapper.get("a");

    expect(link.classes()).toContain("inline-flex");
    expect(link.attributes("disabled")).toBeUndefined();
    expect(link.attributes("aria-busy")).toBeUndefined();
  });
});
