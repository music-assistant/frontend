import { shallowMount, type VueWrapper } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import {
  ConfigEntryType,
  type ConfigEntry,
  type ConfigValueType,
} from "@/plugins/api/interfaces";
import EditConfig from "@/views/settings/EditConfig.vue";

const { apiMock, routerMock } = vi.hoisted(() => ({
  apiMock: {
    players: {},
    providers: {},
  },
  routerMock: {
    push: vi.fn(),
  },
}));

vi.mock("@/plugins/api", () => ({
  api: apiMock,
  default: apiMock,
}));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

vi.mock("vue-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("vue-router")>();
  return {
    ...actual,
    useRouter: () => routerMock,
  };
});

describe("EditConfig", () => {
  it.each([
    ConfigEntryType.DIVIDER,
    ConfigEntryType.LABEL,
    ConfigEntryType.ALERT,
    ConfigEntryType.IMAGE,
  ])("hides a %s entry while its dependency is unmet", (type) => {
    const wrapper = mountEntries([
      entry({ key: "enable_feature", type: ConfigEntryType.BOOLEAN }),
      dependentEntry({ key: "feature_status", type }),
    ]);

    expect(renderedKeys(wrapper)).toEqual(["enable_feature"]);
  });

  it.each([
    ConfigEntryType.DIVIDER,
    ConfigEntryType.LABEL,
    ConfigEntryType.ALERT,
    ConfigEntryType.IMAGE,
  ])("shows a %s entry once its dependency is met", (type) => {
    const wrapper = mountEntries([
      entry({
        key: "enable_feature",
        type: ConfigEntryType.BOOLEAN,
        value: true,
      }),
      dependentEntry({ key: "feature_status", type }),
    ]);

    expect(renderedKeys(wrapper)).toEqual(["enable_feature", "feature_status"]);
  });

  it("keeps an input with an unmet dependency visible but disabled", () => {
    const wrapper = mountEntries([
      entry({ key: "enable_feature", type: ConfigEntryType.BOOLEAN }),
      dependentEntry({ key: "feature_detail", type: ConfigEntryType.STRING }),
    ]);

    const rows = wrapper.findAllComponents({ name: "ConfigEntryRow" });
    expect(renderedKeys(wrapper)).toEqual(["enable_feature", "feature_detail"]);
    expect(rows[0].props("disabled")).toBe(false);
    expect(rows[1].props("disabled")).toBe(true);
  });

  it("hides a label whose dependency key is not in the form", () => {
    const wrapper = mountEntries([
      entry({ key: "enable_feature", type: ConfigEntryType.BOOLEAN }),
      entry({
        key: "feature_status",
        type: ConfigEntryType.LABEL,
        depends_on: "typo_in_this_key",
      }),
    ]);

    expect(renderedKeys(wrapper)).toEqual(["enable_feature"]);
  });

  it("disables an input whose dependency key is not in the form", () => {
    const wrapper = mountEntries([
      entry({
        key: "feature_detail",
        type: ConfigEntryType.STRING,
        depends_on: "typo_in_this_key",
      }),
    ]);

    const rows = wrapper.findAllComponents({ name: "ConfigEntryRow" });
    expect(renderedKeys(wrapper)).toEqual(["feature_detail"]);
    expect(rows[0].props("disabled")).toBe(true);
  });

  it("disables every field while the whole form is disabled", () => {
    const wrapper = mountEntries(
      [
        entry({ key: "enable_feature", type: ConfigEntryType.BOOLEAN }),
        entry({ key: "feature_detail", type: ConfigEntryType.STRING }),
      ],
      true,
    );

    const rows = wrapper.findAllComponents({ name: "ConfigEntryRow" });
    expect(rows.map((row) => row.props("disabled"))).toEqual([true, true]);
  });

  it("keeps a label visible while the whole form is disabled", () => {
    const wrapper = mountEntries(
      [
        entry({ key: "enable_feature", type: ConfigEntryType.BOOLEAN }),
        entry({ key: "feature_status", type: ConfigEntryType.LABEL }),
      ],
      true,
    );

    expect(renderedKeys(wrapper)).toEqual(["enable_feature", "feature_status"]);
  });

  it("reveals a label as soon as the dependency flips, without a save", async () => {
    const entries = [
      entry({ key: "enable_feature", type: ConfigEntryType.BOOLEAN }),
      dependentEntry({ key: "feature_status", type: ConfigEntryType.LABEL }),
    ];
    const wrapper = mountEntries(entries);
    expect(renderedKeys(wrapper)).toEqual(["enable_feature"]);

    // onValueUpdate edits the entry object in place, so this is what ticking the box does
    const toggle = wrapper
      .findAllComponents({ name: "ConfigEntryRow" })[0]
      .props("confEntry") as ConfigEntry;
    toggle.value = true;
    await nextTick();

    expect(renderedKeys(wrapper)).toEqual(["enable_feature", "feature_status"]);
  });

  // a presentational entry carries nothing the user can fill in, so a required one
  // must never be able to block saving the entries that do
  it("saves a dirty form despite a required entry the user cannot fill in", async () => {
    const wrapper = mountEntries([
      entry({ key: "server", type: ConfigEntryType.STRING }),
      entry({
        key: "pairing_code",
        type: ConfigEntryType.IMAGE,
        required: true,
      }),
    ]);

    dirty(wrapper);
    await nextTick();

    expect(saveDisabled(wrapper)).toBe(false);
  });

  it("still blocks saving on a required input the user left empty", async () => {
    const wrapper = mountEntries([
      entry({ key: "server", type: ConfigEntryType.STRING }),
      entry({ key: "token", type: ConfigEntryType.STRING, required: true }),
    ]);

    dirty(wrapper);
    await nextTick();

    expect(saveDisabled(wrapper)).toBe(true);
  });

  // an unmet dependency greys the input out, so a required entry behind one is
  // unfillable and must not hold the whole form hostage
  it("saves a dirty form despite a required entry behind an unmet dependency", async () => {
    const wrapper = mountEntries([
      entry({ key: "server", type: ConfigEntryType.STRING }),
      entry({
        key: "use_proxy",
        type: ConfigEntryType.BOOLEAN,
        value: false,
      }),
      entry({
        key: "proxy_url",
        type: ConfigEntryType.STRING,
        required: true,
        depends_on: "use_proxy",
      }),
    ]);

    dirty(wrapper);
    await nextTick();

    expect(saveDisabled(wrapper)).toBe(false);
  });

  it("blocks saving again once the dependency is met", async () => {
    const entries = [
      entry({ key: "server", type: ConfigEntryType.STRING }),
      entry({ key: "use_proxy", type: ConfigEntryType.BOOLEAN, value: false }),
      entry({
        key: "proxy_url",
        type: ConfigEntryType.STRING,
        required: true,
        depends_on: "use_proxy",
      }),
    ];
    const wrapper = mountEntries(entries);
    dirty(wrapper);

    const toggle = wrapper
      .findAllComponents({ name: "ConfigEntryRow" })[1]
      .props("confEntry") as ConfigEntry;
    toggle.value = true;
    await nextTick();

    expect(saveDisabled(wrapper)).toBe(true);
  });
});

function entry(
  overrides: Partial<ConfigEntry> & { key: string; type: ConfigEntryType },
): ConfigEntry {
  return {
    category: "generic",
    default_value: null,
    label: overrides.key,
    required: false,
    value: null as ConfigValueType,
    ...overrides,
  } as ConfigEntry;
}

function dependentEntry(
  overrides: Partial<ConfigEntry> & { key: string; type: ConfigEntryType },
): ConfigEntry {
  return entry({
    depends_on: "enable_feature",
    depends_on_value: true,
    ...overrides,
  });
}

function mountEntries(configEntries: ConfigEntry[], disabled = false) {
  return shallowMount(EditConfig, {
    props: { configEntries, disabled },
    global: { renderStubDefaultSlot: true },
  });
}

function renderedKeys(wrapper: VueWrapper) {
  return wrapper
    .findAllComponents({ name: "ConfigEntryRow" })
    .map((row) => (row.props("confEntry") as ConfigEntry).key);
}

// edits the first entry in place, which is what typing into its field does
function dirty(wrapper: VueWrapper) {
  const first = wrapper
    .findAllComponents({ name: "ConfigEntryRow" })[0]
    .props("confEntry") as ConfigEntry;
  first.value = "localhost";
}

function saveDisabled(wrapper: VueWrapper) {
  const button = wrapper
    .findAll("v-btn-stub")
    .find((btn) => btn.text() === "settings.save");
  if (!button) throw new Error("save button not rendered");
  return button.attributes("disabled") === "true";
}
