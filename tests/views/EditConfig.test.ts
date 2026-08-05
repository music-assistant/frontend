import { shallowMount, type VueWrapper } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
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
    expect(rows[1].props("disabled")).toBe(true);
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

function mountEntries(configEntries: ConfigEntry[]) {
  return shallowMount(EditConfig, {
    props: { configEntries, disabled: false },
    global: { renderStubDefaultSlot: true },
  });
}

function renderedKeys(wrapper: VueWrapper) {
  return wrapper
    .findAllComponents({ name: "ConfigEntryRow" })
    .map((row) => (row.props("confEntry") as ConfigEntry).key);
}
