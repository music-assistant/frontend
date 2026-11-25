import { provideConfigFormValidation } from "@/composables/useConfigFormValidation";
import { ConfigEntryType, type ConfigEntry } from "@/plugins/api/interfaces";
import ConfigEntryField from "@/views/settings/ConfigEntryField.vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, ref } from "vue";

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

function entry(
  key: string,
  value: string,
  overrides: Partial<ConfigEntry> = {},
): ConfigEntry {
  return {
    key,
    type: ConfigEntryType.STRING,
    category: "generic",
    default_value: null,
    label: key,
    required: true,
    options: [],
    value,
    ...overrides,
  };
}

// a form holding the given entries as its fields
function mountForm(entries: ConfigEntry[]) {
  const shown = ref(entries);
  let validate = () => true;
  const wrapper = mount(
    defineComponent({
      setup() {
        validate = provideConfigFormValidation().validate;
        return () =>
          h(
            "div",
            shown.value.map((confEntry) =>
              h(ConfigEntryField, {
                key: confEntry.key,
                confEntry,
                showPasswordValues: false,
              }),
            ),
          );
      },
    }),
  );
  return { wrapper, shown, validate: () => validate() };
}

describe("useConfigFormValidation", () => {
  it("shows the errors only once the form is checked", async () => {
    const { wrapper, validate } = mountForm([
      entry("name", "Kitchen"),
      entry("server", ""),
    ]);
    expect(wrapper.text()).not.toContain("settings.invalid_input");

    expect(validate()).toBe(false);
    await nextTick();

    expect(wrapper.findAll("p").map((el) => el.text())).toEqual([
      "settings.invalid_input",
    ]);
  });

  it("leaves a field that is no longer shown out of the check", async () => {
    const { shown, validate } = mountForm([
      entry("name", "Kitchen"),
      entry("server", ""),
    ]);

    shown.value = [entry("name", "Kitchen")];
    await nextTick();

    expect(validate()).toBe(true);
  });

  // the save button lets a field the user can not fill in through as well
  it("lets an empty read-only field through", () => {
    const { validate } = mountForm([entry("server", "", { read_only: true })]);

    expect(validate()).toBe(true);
  });
});
