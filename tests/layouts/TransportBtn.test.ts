import TransportBtn from "@/layouts/default/PlayerOSD/PlayerControlBtn/TransportBtn.vue";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";

function mountButton(
  props: { label?: string; disabled?: boolean } = {},
  attrs: Record<string, unknown> = {},
) {
  return mount(TransportBtn, {
    props: { iconSize: 28, ...props },
    attrs,
    slots: { default: "<svg />" },
  });
}

enableAutoUnmount(afterEach);

describe("TransportBtn", () => {
  it("names itself with the label, as tooltip too", () => {
    const button = mountButton({ label: "next_track" }).get("button");

    expect(button.attributes("aria-label")).toBe("next_track");
    expect(button.attributes("title")).toBe("next_track");
  });

  it("lets a caller show a tooltip other than the label", () => {
    const button = mountButton(
      { label: "shuffle" },
      { title: "shuffle_enable" },
    ).get("button");

    expect(button.attributes("aria-label")).toBe("shuffle");
    expect(button.attributes("title")).toBe("shuffle_enable");
  });

  it("does not emit a click while disabled", async () => {
    const wrapper = mountButton({ disabled: true });

    expect(wrapper.get("button").attributes("disabled")).toBeDefined();
    await wrapper.get("button").trigger("click");

    expect(wrapper.emitted("click")).toBeUndefined();
  });

  it("passes the pressed state through", () => {
    const button = mountButton({}, { "aria-pressed": "true" }).get("button");

    expect(button.attributes("aria-pressed")).toBe("true");
  });

  it("sizes the glyph from the icon size", () => {
    const button = mountButton().get("button");

    expect(button.attributes("style")).toContain("--icon-size: 28px");
  });

  it("lets a caller replace its box size", () => {
    const button = mountButton({}, { class: "size-15" }).get("button");

    expect(button.classes()).toContain("size-15");
    expect(button.classes()).not.toContain("size-10");
  });

  it("acts once on a held Enter", async () => {
    const button = mountButton().get("button");
    const press = (repeat: boolean) => {
      const event = new KeyboardEvent("keydown", {
        key: "Enter",
        repeat,
        cancelable: true,
      });
      button.element.dispatchEvent(event);
      return event.defaultPrevented;
    };

    expect(press(false)).toBe(false);
    expect(press(true)).toBe(true);
  });
});
