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
  it("offers its options as a single choice", () => {
    mountField("music");

    expect(wrapper!.find('[role="radiogroup"]').exists()).toBe(true);
    expect(optionButtons().map((button) => button.attributes("role"))).toEqual([
      "radio",
      "radio",
      "radio",
    ]);
  });

  it("marks the option that holds the current value", () => {
    mountField("music");

    expect(checkedStates()).toEqual(["true", "false", "false"]);
    // marked by more than colour
    expect(optionButtons()[0].find("svg").exists()).toBe(true);
    expect(optionButtons()[1].find("svg").exists()).toBe(false);
  });

  it("moves the mark to the option clicked and hands over its value", async () => {
    mountField("music");

    await optionButtons()[1].trigger("click");

    expect(wrapper!.emitted("update:value")).toEqual([["audiobooks"]]);
    expect(checkedStates()).toEqual(["false", "true", "false"]);
  });

  it("marks nothing without a current value", () => {
    mountField(null);

    expect(checkedStates()).toEqual(["false", "false", "false"]);
  });

  it("can not select a disabled option", async () => {
    mountField("music");

    const podcasts = optionButtons()[2];
    expect(podcasts.attributes("disabled")).toBeDefined();
    await podcasts.trigger("click");

    expect(wrapper!.emitted("update:value")).toBeUndefined();
    expect(checkedStates()).toEqual(["true", "false", "false"]);
  });

  it("lays options with nothing to explain out side by side", async () => {
    mountField("music", SHORT_OPTIONS);

    const group = wrapper!.get('[role="radiogroup"]');
    expect(group.attributes("data-layout")).toBe("compact");
    expect(group.classes()).toContain("grid");
    // the selection keeps its mark
    expect(checkedStates()).toEqual(["true", "false", "false", "false"]);
    expect(optionButtons()[0].find("svg").exists()).toBe(true);

    await optionButtons()[3].trigger("click");

    expect(checkedStates()).toEqual(["false", "false", "false", "true"]);
  });

  it.each([
    ["a description", { description: "Your own recordings." }],
    ["a disabled reason", { disabled: true, disabled_reason: "Not here." }],
  ])("keeps the options stacked when one carries %s", (_label, extra) => {
    mountField("music", [
      ...SHORT_OPTIONS.slice(0, 3),
      { ...SHORT_OPTIONS[3], ...extra },
    ]);

    expect(wrapper!.get('[role="radiogroup"]').attributes("data-layout")).toBe(
      "stacked",
    );
  });

  it("moves the focus side by side in reading order", async () => {
    mountField("music", SHORT_OPTIONS);
    const buttons = optionButtons();
    (buttons[1].element as HTMLButtonElement).focus();

    await buttons[1].trigger("keydown", { key: "ArrowRight" });
    expect(document.activeElement).toBe(buttons[2].element);
    await buttons[2].trigger("keydown", { key: "ArrowLeft" });
    expect(document.activeElement).toBe(buttons[1].element);
  });

  // a step that submits on pick must not submit on a keypress that only moves around
  it("moves the focus with the arrow keys without picking", async () => {
    mountField("music");
    const [music, audiobooks] = optionButtons();
    (music.element as HTMLButtonElement).focus();

    await music.trigger("keydown", { key: "ArrowDown" });

    expect(document.activeElement).toBe(audiobooks.element);
    // the disabled option is skipped, so the focus wraps around to the first
    await audiobooks.trigger("keydown", { key: "ArrowDown" });
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

function checkedStates() {
  return optionButtons().map((button) => button.attributes("aria-checked"));
}
