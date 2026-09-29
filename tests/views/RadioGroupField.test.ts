import type {
  ConfigValueOption,
  ConfigValueType,
} from "@/plugins/api/interfaces";
import RadioGroupField from "@/views/settings/fields/RadioGroupField.vue";
import { mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";

const OPTIONS: ConfigValueOption[] = [
  { title: "Music", value: "music" },
  { title: "Audiobooks", value: "audiobooks" },
  {
    title: "Podcasts",
    value: "podcasts",
    disabled: true,
    disabled_reason: "Not available here.",
  },
];

// options with nothing to explain, as the content types of Local files
const SHORT_OPTIONS: ConfigValueOption[] = [
  { title: "Music", value: "music" },
  { title: "Audiobooks", value: "audiobooks" },
  { title: "Podcasts", value: "podcasts" },
  { title: "Sound Effects", value: "sound_effects" },
];

let wrapper: VueWrapper | undefined;

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
});

describe("RadioGroupField", () => {
  it("offers its options as a labelled group of toggle buttons", () => {
    mountField("music");

    const group = wrapper!.get('[role="group"]');
    expect(wrapper!.get(`#${group.attributes("aria-labelledby")}`).text()).toBe(
      "What do you want to add?",
    );
    expect(
      optionButtons().map((button) => [
        button.element.tagName,
        button.attributes("role"),
      ]),
    ).toEqual([
      ["BUTTON", undefined],
      ["BUTTON", undefined],
      ["BUTTON", undefined],
    ]);
  });

  it("keeps every option in the tab order, as buttons are", () => {
    mountField("music");

    expect(
      optionButtons().map(
        (button) => (button.element as HTMLButtonElement).tabIndex,
      ),
    ).toEqual([0, 0, 0]);
  });

  it("marks the option that holds the current value", () => {
    mountField("music");

    expect(pressedStates()).toEqual(["true", "false", "false"]);
    // marked by more than colour
    expect(optionButtons()[0].find("svg").exists()).toBe(true);
    expect(optionButtons()[1].find("svg").exists()).toBe(false);
  });

  it("moves the mark to the option clicked and hands over its value", async () => {
    mountField("music");

    await optionButtons()[1].trigger("click");

    expect(wrapper!.emitted("update:value")).toEqual([["audiobooks"]]);
    expect(pressedStates()).toEqual(["false", "true", "false"]);
  });

  it("marks nothing without a current value", () => {
    mountField(null);

    expect(pressedStates()).toEqual(["false", "false", "false"]);
  });

  it("can not select a disabled option", async () => {
    mountField("music");

    const podcasts = optionButtons()[2];
    expect(podcasts.attributes("disabled")).toBeDefined();
    await podcasts.trigger("click");

    expect(wrapper!.emitted("update:value")).toBeUndefined();
    expect(pressedStates()).toEqual(["true", "false", "false"]);
  });

  it("lays options with nothing to explain out side by side", async () => {
    mountField("music", SHORT_OPTIONS);

    const group = wrapper!.get('[role="group"]');
    expect(group.attributes("data-layout")).toBe("compact");
    expect(group.classes()).toContain("grid");
    // the selection keeps its mark
    expect(pressedStates()).toEqual(["true", "false", "false", "false"]);
    expect(optionButtons()[0].find("svg").exists()).toBe(true);

    await optionButtons()[3].trigger("click");

    expect(pressedStates()).toEqual(["false", "false", "false", "true"]);
  });

  it.each([
    ["a description", { description: "Your own recordings." }],
    ["a disabled reason", { disabled: true, disabled_reason: "Not here." }],
  ])("keeps the options stacked when one carries %s", (_label, extra) => {
    mountField("music", [
      ...SHORT_OPTIONS.slice(0, 3),
      { ...SHORT_OPTIONS[3], ...extra },
    ]);

    expect(wrapper!.get('[role="group"]').attributes("data-layout")).toBe(
      "stacked",
    );
  });

  // a step that submits on pick must only go on when an option is pressed
  it("leaves the arrow keys alone", async () => {
    mountField("music");
    const [music] = optionButtons();
    (music.element as HTMLButtonElement).focus();

    const arrow = new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    });
    music.element.dispatchEvent(arrow);

    expect(arrow.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(music.element);
    expect(wrapper!.emitted("update:value")).toBeUndefined();
  });
});

/** Mounts the field the way its form does: a picked value comes back as the current one. */
function mountField(value: ConfigValueType, options = OPTIONS) {
  wrapper = mount(RadioGroupField, {
    props: {
      label: "What do you want to add?",
      options,
      value,
      "onUpdate:value": (picked: ConfigValueType) =>
        wrapper!.setProps({ value: picked }),
    },
    attachTo: document.body,
  });
}

function optionButtons() {
  return wrapper!.findAll('[data-testid="option-button"]');
}

function pressedStates() {
  return optionButtons().map((button) => button.attributes("aria-pressed"));
}
