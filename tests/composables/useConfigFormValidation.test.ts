import {
  provideConfigFormValidation,
  useConfigFieldValidation,
} from "@/composables/useConfigFormValidation";
import { ConfigEntryType, type ConfigEntry } from "@/plugins/api/interfaces";
import ConfigEntryField from "@/views/settings/ConfigEntryField.vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { h, nextTick, ref, type VNode } from "vue";

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

// a field that is invalid while `invalid` is set; its button stands in for the
// user changing or leaving the field
const Field = {
  props: { invalid: { type: Boolean, required: true } },
  setup(props: { invalid: boolean }) {
    const { error, touch } = useConfigFieldValidation(
      () => props.invalid,
      () => "invalid",
    );
    return () =>
      h("div", [h("button", { onClick: touch }), h("p", error.value ?? "")]);
  },
};

// a form holding what `fields` renders, with the form's own check
function mountForm(fields: () => VNode[]) {
  let validate = () => true;
  const wrapper = mount({
    setup() {
      validate = provideConfigFormValidation().validate;
      return () => h("div", fields());
    },
  });
  return { wrapper, validate: () => validate() };
}

const errors = (wrapper: ReturnType<typeof mountForm>["wrapper"]) =>
  wrapper.findAll("p").map((p) => p.text());

describe("useConfigFormValidation", () => {
  it("fails the check and shows the errors of invalid fields", async () => {
    const { wrapper, validate } = mountForm(() => [
      h(Field, { invalid: false }),
      h(Field, { invalid: true }),
    ]);
    expect(errors(wrapper)).toEqual(["", ""]);

    expect(validate()).toBe(false);
    await nextTick();

    expect(errors(wrapper)).toEqual(["", "invalid"]);
  });

  it("shows the error of a field once it is touched", async () => {
    const { wrapper } = mountForm(() => [h(Field, { invalid: true })]);

    await wrapper.get("button").trigger("click");

    expect(errors(wrapper)).toEqual(["invalid"]);
  });

  it("stops checking a field once it is unmounted", async () => {
    const shown = ref(true);
    const { validate } = mountForm(() =>
      shown.value ? [h(Field, { invalid: true })] : [],
    );

    shown.value = false;
    await nextTick();

    expect(validate()).toBe(true);
  });

  it("fails the check for an empty required config field", () => {
    const { validate } = mountForm(() => [configField(requiredText())]);

    expect(validate()).toBe(false);
  });

  // the save button lets a field the user can not fill in through as well
  it("lets an empty read-only config field through", () => {
    const { validate } = mountForm(() => [
      configField({ ...requiredText(), read_only: true }),
    ]);

    expect(validate()).toBe(true);
  });
});

function requiredText(): ConfigEntry {
  return {
    key: "server",
    type: ConfigEntryType.STRING,
    category: "generic",
    default_value: null,
    label: "server",
    required: true,
    options: [],
    value: "",
  };
}

function configField(confEntry: ConfigEntry) {
  return h(ConfigEntryField, { confEntry, showPasswordValues: false });
}
