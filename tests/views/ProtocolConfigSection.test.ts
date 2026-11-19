import { mount, shallowMount, type VueWrapper } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isEntryDisabled, type ConfigEntryUI } from "@/helpers/config_entry_ui";
import type { ContextMenuItem } from "@/helpers/context_menu_item";
import {
  ConfigEntryType,
  type ConfigEntry,
  type OutputProtocol,
} from "@/plugins/api/interfaces";
import MultiChannelSpeakers from "@/views/settings/MultiChannelSpeakers.vue";
import ProtocolConfigSection from "@/views/settings/ProtocolConfigSection.vue";

const { apiMock, emitEvent } = vi.hoisted(() => ({
  apiMock: {
    getProvider: vi.fn(),
  },
  emitEvent: vi.fn(),
}));

vi.mock("@/plugins/api", () => ({
  api: apiMock,
  default: apiMock,
}));

vi.mock("@/plugins/eventbus", () => ({
  eventbus: { emit: emitEvent },
}));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

describe("ProtocolConfigSection", () => {
  beforeEach(() => {
    emitEvent.mockReset();
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

  it("renders a single protocol without an accordion", () => {
    const wrapper = mountSection(
      [entry("native_buffer", "protocol_sonos")],
      [outputProtocol("native", "sonos", true)],
    );

    expect(wrapper.findComponent({ name: "Accordion" }).exists()).toBe(false);
    expect(wrapper.findComponent({ name: "AccordionTrigger" }).exists()).toBe(
      false,
    );
    expect(renderedKeys(wrapper)).toEqual(["native_buffer"]);
    expect(wrapper.getComponent({ name: "Badge" }).text()).toBe(
      "settings.protocol_native_badge",
    );
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
    expect(wrapper.text()).toContain("settings.protocol_provider_unavailable");
  });

  it("offers a menu only on an output that has something to offer", () => {
    const outputMenuItems = vi.fn((output: OutputProtocol) =>
      output.protocol_domain === "airplay" ? [SPLIT_OFF_ITEM] : [],
    );

    const wrapper = mountSection(MULTIPLE_OUTPUT_ENTRIES, MULTIPLE_OUTPUTS, {
      outputMenuItems,
    });

    const panels = wrapper.findAllComponents({ name: "AccordionItem" });
    expect(panels.map((panel) => panel.find(OUTPUT_MENU).exists())).toEqual([
      false,
      true,
    ]);
    expect(panels[1].get(OUTPUT_MENU).attributes("aria-label")).toBe(
      "more_options: airplay",
    );
    expect(outputMenuItems).toHaveBeenCalledWith(MULTIPLE_OUTPUTS[1]);
    // the output without a menu keeps its place, so the chevrons line up
    expect(
      panels.map((panel) => panel.find(OUTPUT_MENU_PLACEHOLDER).exists()),
    ).toEqual([true, false]);
  });

  it("offers no menu on a config that is not a player's", () => {
    const wrapper = mountSection(MULTIPLE_OUTPUT_ENTRIES, MULTIPLE_OUTPUTS);

    expect(wrapper.find(OUTPUT_MENU).exists()).toBe(false);
    expect(wrapper.find(OUTPUT_MENU_PLACEHOLDER).exists()).toBe(false);
  });

  it("opens the menu of an output under its button without toggling its panel", async () => {
    const wrapper = mount(ProtocolConfigSection, {
      props: {
        ...sectionProps(MULTIPLE_OUTPUT_ENTRIES, MULTIPLE_OUTPUTS),
        outputMenuItems: () => [SPLIT_OFF_ITEM],
      },
      global: { stubs: { ConfigEntryRow: true, ProviderIcon: true } },
    });
    const panel = wrapper.findAll('[data-slot="accordion-item"]')[1];
    const menuButton = panel.get(OUTPUT_MENU);
    vi.spyOn(menuButton.element, "getBoundingClientRect").mockReturnValue(
      new DOMRect(40, 20, 32, 32),
    );

    await menuButton.trigger("click");

    expect(emitEvent).toHaveBeenCalledWith("contextmenu", {
      items: [SPLIT_OFF_ITEM],
      posX: 40,
      posY: 52,
    });
    expect(panel.attributes("data-state")).toBe("closed");
    // the trigger beside it still opens the panel
    await panel.get('[data-slot="accordion-trigger"]').trigger("click");
    expect(panel.attributes("data-state")).toBe("open");
  });

  it("shows the speakers of a multi-channel player as rows of their own", () => {
    const entries = stereoPairEntries();
    const wrapper = mountStereoPair(entries, true);

    // the entries of no speaker keep the generic rows
    expect(renderedKeys(wrapper)).toEqual(["note"]);
    const speakers = wrapper.getComponent(MultiChannelSpeakers);
    expect(
      (speakers.props("speakers") as { name: string }[]).map(
        (speaker) => speaker.name,
      ),
    ).toEqual(["Studio left", "Studio right"]);

    const channel = entries.find(
      (configEntry) => configEntry.key === "speaker_1_channel_setting",
    )!;
    speakers.vm.$emit("update:value", channel, "front_right");
    expect(wrapper.emitted("update:value")?.[0]).toEqual([
      channel,
      "front_right",
    ]);
  });

  it("shows no speaker rows for the protocol of any other player", () => {
    const wrapper = mountStereoPair(stereoPairEntries(), false);

    expect(wrapper.findComponent(MultiChannelSpeakers).exists()).toBe(false);
    expect(renderedKeys(wrapper)).toContain("speaker_1_channel_setting");
  });

  it("shows no speaker rows for keys without both the state and the channel", () => {
    const entries = stereoPairEntries().filter(
      (configEntry) =>
        configEntry.key !== "speaker_1_state" &&
        configEntry.key !== "speaker_2_channel_setting",
    );
    const wrapper = mountStereoPair(entries, true);

    expect(wrapper.findComponent(MultiChannelSpeakers).exists()).toBe(false);
  });

  it("offers the menu of a single output too", () => {
    const wrapper = mountSection(
      [entry("native_buffer", "protocol_sonos")],
      [outputProtocol("native", "sonos", true)],
      { outputMenuItems: () => [SPLIT_OFF_ITEM] },
    );

    expect(wrapper.findComponent({ name: "Accordion" }).exists()).toBe(false);
    expect(wrapper.find(OUTPUT_MENU).exists()).toBe(true);
  });
});

const OUTPUT_MENU = '[data-testid="output-menu"]';

const OUTPUT_MENU_PLACEHOLDER = '[data-testid="output-menu-placeholder"]';

const SPLIT_OFF_ITEM: ContextMenuItem = { label: "settings.split_off_output" };

// a native output without a menu next to an output with one
const MULTIPLE_OUTPUT_ENTRIES = [
  entry("native_buffer", "protocol_sonos"),
  enabledEntry("airplay-output", "protocol_airplay", true),
];

const MULTIPLE_OUTPUTS = [
  outputProtocol("native", "sonos", true),
  outputProtocol("airplay-output", "airplay"),
];

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

// the Sendspin protocol of a stereo pair: two speakers and one entry of its own
function stereoPairEntries(): ConfigEntry[] {
  const category = "protocol_sendspin";
  return [
    entry("note", category, { type: ConfigEntryType.LABEL }),
    ...[
      [1, "Studio left", "front_left"],
      [2, "Studio right", "front_right"],
    ].flatMap(([number, name, channel]) => [
      entry(`speaker_${number}_state`, category, {
        type: ConfigEntryType.LABEL,
        value: "online",
      }),
      entry(`speaker_${number}_display_name`, category, {
        type: ConfigEntryType.LABEL,
        label: "Speaker",
        value: name,
      }),
      entry(`speaker_${number}_channel_setting`, category, { value: channel }),
    ]),
  ];
}

function mountStereoPair(entries: ConfigEntry[], multiChannel: boolean) {
  return shallowMount(ProtocolConfigSection, {
    props: {
      ...sectionProps(entries, [outputProtocol("native", "sendspin", true)]),
      multiChannel,
    },
    global: { renderStubDefaultSlot: true },
  });
}

function mountSection(
  entries: ConfigEntryUI[],
  outputProtocols: OutputProtocol[],
  extraProps: {
    outputMenuItems?: (output: OutputProtocol) => ContextMenuItem[];
  } = {},
) {
  return shallowMount(ProtocolConfigSection, {
    props: { ...sectionProps(entries, outputProtocols), ...extraProps },
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
