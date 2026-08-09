import { shallowMount, type VueWrapper } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isEntryDisabled, type ConfigEntryUI } from "@/helpers/config_entry_ui";
import {
  ConfigEntryType,
  type ConfigEntry,
  type OutputProtocol,
} from "@/plugins/api/interfaces";
import ProtocolConfigSection from "@/views/settings/ProtocolConfigSection.vue";

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    getProvider: vi.fn(),
  },
}));

vi.mock("@/plugins/api", () => ({
  api: apiMock,
  default: apiMock,
}));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

describe("ProtocolConfigSection", () => {
  beforeEach(() => {
    apiMock.getProvider.mockReset();
    apiMock.getProvider.mockImplementation((domain: string) => ({
      available: true,
      name: domain,
    }));
  });

  it("renders every protocol once with its enable entry first", () => {
    const entries = [
      entry("native_buffer", "protocol_sonos"),
      enabledEntry("airplay-output", "protocol_airplay", true),
      protocolEntry("airplay-output", "buffer", "protocol_airplay"),
      enabledEntry("cast-output", "protocol_chromecast", false),
      protocolEntry("cast-output", "buffer", "protocol_chromecast"),
    ];

    const wrapper = mountSection(entries, [
      outputProtocol("native", "sonos", true),
      outputProtocol("airplay-output", "airplay"),
      outputProtocol("cast-output", "chromecast"),
    ]);

    expect(renderedPanels(wrapper)).toEqual([
      "protocol_sonos",
      "protocol_airplay",
      "protocol_chromecast",
    ]);
    expect(wrapper.getComponent({ name: "Accordion" }).props()).toMatchObject({
      collapsible: true,
      type: "single",
    });
    const panels = wrapper.findAllComponents({ name: "AccordionItem" });
    expect(panels[0].getComponent({ name: "Badge" }).text()).toBe(
      "settings.protocol_native_badge",
    );
    expect(panels[1].findComponent({ name: "Badge" }).exists()).toBe(false);
    expect(renderedKeys(wrapper)).toEqual([
      "native_buffer",
      "airplay-output||protocol||enabled",
      "airplay-output||protocol||buffer",
      "cast-output||protocol||enabled",
      "cast-output||protocol||buffer",
    ]);
  });

  it("keeps a disabled protocol configurable and gates its settings", async () => {
    const disabledEntries = [
      enabledEntry("airplay-output", "protocol_airplay", false),
      protocolEntry("airplay-output", "buffer", "protocol_airplay"),
    ];
    const protocols = [outputProtocol("airplay-output", "airplay")];
    const wrapper = mountSection(disabledEntries, protocols);

    expect(
      row(wrapper, "airplay-output||protocol||enabled").props("disabled"),
    ).toBe(false);
    expect(
      row(wrapper, "airplay-output||protocol||buffer").props("disabled"),
    ).toBe(true);

    const enabledEntries = [
      enabledEntry("airplay-output", "protocol_airplay", true),
      protocolEntry("airplay-output", "buffer", "protocol_airplay"),
    ];
    await wrapper.setProps(sectionProps(enabledEntries, protocols));

    expect(
      row(wrapper, "airplay-output||protocol||buffer").props("disabled"),
    ).toBe(false);
  });

  it("uses the server enable entry for a read-only derived protocol", () => {
    const derivedToggle = enabledEntry(
      "sendspin-output",
      "protocol_sendspin",
      false,
      {
        description: "Enable AirPlay first",
        read_only: true,
      },
    );
    const wrapper = mountSection(
      [derivedToggle],
      [
        outputProtocol("airplay-output", "airplay"),
        {
          ...outputProtocol("sendspin-output", "sendspin"),
          derived_from: "airplay-output",
        },
      ],
    );
    const toggleRow = row(wrapper, "sendspin-output||protocol||enabled");

    expect(toggleRow.props("confEntry")).toMatchObject({
      description: "Enable AirPlay first",
      read_only: true,
    });

    toggleRow.vm.$emit("update:value", true);

    expect(wrapper.emitted("update:value")?.[0]).toEqual([
      expect.objectContaining({ key: "sendspin-output||protocol||enabled" }),
      true,
    ]);
  });

  it("disables all entries when the protocol provider is unavailable", () => {
    apiMock.getProvider.mockReturnValue({
      available: false,
      name: "AirPlay",
    });
    const entries = [
      enabledEntry("airplay-output", "protocol_airplay", true),
      protocolEntry("airplay-output", "buffer", "protocol_airplay"),
    ];

    const wrapper = mountSection(entries, [
      outputProtocol("airplay-output", "airplay"),
    ]);

    expect(
      renderedRows(wrapper).map((configRow) => configRow.props("disabled")),
    ).toEqual([true, true]);
  });
});

function entry(
  key: string,
  category: string,
  overrides: Partial<ConfigEntry> = {},
): ConfigEntry {
  return {
    category,
    category_label: category,
    default_value: null,
    key,
    label: key,
    options: [],
    required: false,
    type: ConfigEntryType.STRING,
    value: null,
    ...overrides,
  };
}

function enabledEntry(
  playerId: string,
  category: string,
  value: boolean,
  overrides: Partial<ConfigEntry> = {},
): ConfigEntry {
  return entry(`${playerId}||protocol||enabled`, category, {
    default_value: true,
    type: ConfigEntryType.BOOLEAN,
    value,
    ...overrides,
  });
}

function protocolEntry(
  playerId: string,
  key: string,
  category: string,
): ConfigEntry {
  return entry(`${playerId}||protocol||${key}`, category, {
    depends_on: `${playerId}||protocol||enabled`,
    value: "default",
  });
}

function outputProtocol(
  id: string,
  domain: string,
  isNative = false,
): OutputProtocol {
  return {
    available: true,
    derived_from: null,
    is_native: isNative,
    name: domain,
    output_protocol_id: id,
    priority: isNative ? 0 : 50,
    protocol_domain: domain,
  };
}

function sectionProps(
  entries: ConfigEntryUI[],
  outputProtocols: OutputProtocol[],
) {
  const protocolPanels = [
    ...new Set(
      entries
        .map((configEntry) => configEntry.category)
        .filter(
          (category) =>
            category.startsWith("protocol_") && category !== "protocol_general",
        ),
    ),
  ];
  const visibleEntriesByCategory: Record<string, ConfigEntryUI[]> = {};
  for (const configEntry of entries) {
    if (configEntry.key.endsWith("||protocol||enabled")) continue;
    visibleEntriesByCategory[configEntry.category] ||= [];
    visibleEntriesByCategory[configEntry.category].push(configEntry);
  }
  return {
    entries,
    isDisabled: (configEntry: ConfigEntryUI) =>
      isEntryDisabled(configEntry, entries),
    outputProtocols,
    protocolPanels,
    showPasswordValues: false,
    visibleEntriesByCategory,
  };
}

function mountSection(
  entries: ConfigEntryUI[],
  outputProtocols: OutputProtocol[],
) {
  return shallowMount(ProtocolConfigSection, {
    props: sectionProps(entries, outputProtocols),
    global: { renderStubDefaultSlot: true },
  });
}

function renderedRows(wrapper: VueWrapper) {
  return wrapper.findAllComponents({ name: "ConfigEntryRow" });
}

function renderedKeys(wrapper: VueWrapper) {
  return renderedRows(wrapper).map(
    (configRow) => (configRow.props("confEntry") as ConfigEntryUI).key,
  );
}

function renderedPanels(wrapper: VueWrapper) {
  return wrapper
    .findAllComponents({ name: "AccordionItem" })
    .map((panel) => panel.props("value"));
}

function row(wrapper: VueWrapper, key: string) {
  const configRow = renderedRows(wrapper).find(
    (candidate) => (candidate.props("confEntry") as ConfigEntryUI).key === key,
  );
  if (!configRow) throw new Error(`Config row ${key} not rendered`);
  return configRow;
}
