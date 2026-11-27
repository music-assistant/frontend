import {
  enableAutoUnmount,
  flushPromises,
  mount,
  shallowMount,
  type VueWrapper,
} from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { h, nextTick } from "vue";
import { createMemoryHistory, createRouter, RouterView } from "vue-router";
import {
  ConfigEntryType,
  type ConfigEntry,
  type ConfigValueType,
} from "@/plugins/api/interfaces";
import EditConfig from "@/views/settings/EditConfig.vue";

const { apiMock, routerMock, setUserPreference, storeMock } = vi.hoisted(
  () => ({
    apiMock: {
      players: {},
      providers: {},
    },
    routerMock: {
      push: vi.fn(),
    },
    setUserPreference: vi.fn(async () => true),
    storeMock: {
      frameless: false,
      mobileLayout: false,
      roleScopes: {},
      currentUser: undefined as
        { preferences: Record<string, unknown> } | undefined,
    },
  }),
);

vi.mock("@/composables/userPreferences", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/composables/userPreferences")>()),
  setUserPreference,
}));

vi.mock("@/plugins/api", () => ({
  api: apiMock,
  default: apiMock,
}));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));
vi.mock("@/plugins/store", () => ({ store: storeMock }));

vi.mock("vue-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("vue-router")>();
  const { inject } = await vi.importActual<typeof import("vue")>("vue");
  return {
    ...actual,
    // the routed tests install a real router; the rest mount the form on its own
    useRouter: () => inject(actual.routerKey, routerMock as never),
  };
});

// the form listens for beforeunload, so a leaked instance keeps reacting
enableAutoUnmount(afterEach);

describe("EditConfig", () => {
  beforeEach(() => {
    storeMock.frameless = false;
    storeMock.mobileLayout = false;
    storeMock.currentUser = undefined;
    setUserPreference.mockClear();
  });

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

  it("fills in the entry a field points at and offers the value under its name", async () => {
    const wrapper = mountEntries([
      entry({
        key: "power_control",
        type: ConfigEntryType.STRING,
        value: "none",
        options: [{ title: "None", value: "none" }],
      }),
    ]);

    const row = wrapper.findAllComponents({ name: "ConfigEntryRow" })[0];
    row.vm.$emit("set-entry-value", "power_control", "switch.amp", "Amplifier");
    await nextTick();

    const target = row.props("confEntry") as ConfigEntry;
    expect(target.value).toBe("switch.amp");
    // the server has not listed it yet, so the name must come from the field
    expect(target.options).toContainEqual({
      title: "Amplifier",
      value: "switch.amp",
    });
    expect(saveDisabled(wrapper)).toBe(false);
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

  it("leaves resetting to defaults to the settings screen around it", async () => {
    const wrapper = mountEntries([
      entry({ key: "server", type: ConfigEntryType.STRING }),
    ]);

    dirty(wrapper);
    await nextTick();

    expect(wrapper.get('[data-testid="config-save"]').text()).toContain(
      "settings.save",
    );
    expect(wrapper.text()).not.toContain("settings.reset_to_defaults");
  });

  it("puts every entry but a hidden one back to its default value on request", async () => {
    const wrapper = mountEntries([
      entry({
        key: "server",
        type: ConfigEntryType.STRING,
        default_value: "localhost",
        value: "elsewhere",
      }),
    ]);

    wrapper.vm.resetToDefaults();
    await nextTick();

    expect(
      (
        wrapper
          .findAllComponents({ name: "ConfigEntryRow" })[0]
          .props("confEntry") as ConfigEntry
      ).value,
    ).toBe("localhost");
    expect(saveDisabled(wrapper)).toBe(false);
  });

  it("leaves a hidden entry as it is when resetting to defaults", () => {
    // housekeeping the server keeps in the config, out of the user's sight
    const cursor = entry({
      key: "track_reconciliation_cursor",
      type: ConfigEntryType.STRING,
      hidden: true,
      default_value: "",
      value: "track/1234",
    });
    const wrapper = mountEntries([
      entry({
        key: "server",
        type: ConfigEntryType.STRING,
        default_value: "localhost",
        value: "elsewhere",
      }),
      cursor,
    ]);

    wrapper.vm.resetToDefaults();
    // an action hands over the same values a save does
    wrapper.findAllComponents({ name: "ConfigEntryRow" })[0].vm.$emit("action");

    expect(cursor.value).toBe("track/1234");
    expect(wrapper.emitted("action")?.[0]?.[1]).toEqual({
      server: "localhost",
      track_reconciliation_cursor: "track/1234",
    });
  });

  it("saves an entry reset to its default as null, so the server unsets it", async () => {
    const wrapper = mountForSave([
      entry({
        key: "server",
        type: ConfigEntryType.STRING,
        default_value: "localhost",
        value: "elsewhere",
      }),
      entry({
        key: "token",
        type: ConfigEntryType.STRING,
        default_value: "",
        value: "secret",
      }),
    ]);

    wrapper.vm.resetToDefaults();
    // an entry edited after the reset is a value the user chose
    wrapper
      .findAllComponents({ name: "ConfigEntryRow" })[1]
      .vm.$emit("update:value", "other");
    await wrapper.vm.submit();

    expect(wrapper.emitted("submit")?.[0]?.[0]).toEqual({
      server: null,
      token: "other",
    });
  });

  it("keeps the channel of each speaker of a multi-channel player through a reset", async () => {
    const wrapper = mountForSave(stereoPairEntries(), { multiChannel: true });

    wrapper.vm.resetToDefaults();
    await wrapper.vm.submit();

    // the channel takes its default as a value, and the rest is unset
    expect(wrapper.emitted("submit")?.[0]?.[0]).toEqual({
      server: null,
      speaker_1_state: "online",
      speaker_1_channel_setting: "front_left",
      speaker_1_output_delay: null,
    });
  });

  it("unsets the same keys on the config of any other player", async () => {
    const wrapper = mountForSave(stereoPairEntries());

    wrapper.vm.resetToDefaults();
    await wrapper.vm.submit();

    expect(wrapper.emitted("submit")?.[0]?.[0]).toEqual({
      server: null,
      speaker_1_state: "online",
      speaker_1_channel_setting: null,
      speaker_1_output_delay: null,
    });
  });

  it("keeps sending the value of a switch that turns an output on after a reset", async () => {
    const wrapper = mountForSave([
      entry({
        key: "airplay_1||protocol||enabled",
        type: ConfigEntryType.BOOLEAN,
        default_value: true,
        value: false,
      }),
    ]);

    wrapper.vm.resetToDefaults();
    await wrapper.vm.submit();

    expect(wrapper.emitted("submit")?.[0]?.[0]).toEqual({
      "airplay_1||protocol||enabled": true,
    });
  });

  it("offers saving a reset that leaves every value as it shows", async () => {
    // the server may still store the default as a value the user chose
    const wrapper = mountEntries([
      entry({
        key: "server",
        type: ConfigEntryType.STRING,
        default_value: "localhost",
        value: "localhost",
      }),
    ]);

    wrapper.vm.resetToDefaults();
    await nextTick();
    expect(saveDisabled(wrapper)).toBe(false);

    wrapper.vm.saveSucceeded({ server: null });
    await nextTick();
    expect(saveDisabled(wrapper)).toBe(true);
  });

  it("stops offering to save the values the server took", async () => {
    const wrapper = mountEntries([
      entry({ key: "server", type: ConfigEntryType.STRING }),
    ]);

    dirty(wrapper);
    await nextTick();
    expect(saveDisabled(wrapper)).toBe(false);

    wrapper.vm.saveSucceeded({ server: "localhost" });
    await nextTick();
    expect(saveDisabled(wrapper)).toBe(true);

    // and offers again for whatever is typed next
    edit(wrapper, 0, "elsewhere");
    await nextTick();
    expect(saveDisabled(wrapper)).toBe(false);
  });

  it("keeps offering an edit the save did not carry", async () => {
    const wrapper = mountEntries([
      entry({ key: "server", type: ConfigEntryType.STRING }),
      entry({ key: "token", type: ConfigEntryType.STRING }),
    ]);

    dirty(wrapper);
    await nextTick();

    // the form stays open while a save is on its way, so what lands covers the
    // values that were sent and nothing the user typed in the meantime
    edit(wrapper, 1, "secret");
    wrapper.vm.saveSucceeded({ server: "localhost" });
    await nextTick();

    expect(saveDisabled(wrapper)).toBe(false);
  });

  it("hides the save action on a disabled form", () => {
    const wrapper = mountEntries(
      [entry({ key: "server", type: ConfigEntryType.STRING })],
      true,
    );

    expect(wrapper.find('[data-testid="config-save"]').exists()).toBe(false);
  });

  it("pins the save action to a bar that says when there are unsaved changes", async () => {
    const wrapper = mountEntries([
      entry({ key: "server", type: ConfigEntryType.STRING }),
    ]);
    const bar = wrapper.getComponent({ name: "SettingsSaveBar" });
    expect(bar.props("inline")).toBe(false);
    expect(bar.props("unsavedChanges")).toBe(false);
    expect(bar.find('[data-testid="config-save"]').exists()).toBe(true);

    dirty(wrapper);
    await nextTick();

    expect(bar.props("unsavedChanges")).toBe(true);
  });

  it("keeps the save action in the flow of the form when asked", () => {
    const wrapper = mountEntries(
      [entry({ key: "server", type: ConfigEntryType.STRING })],
      false,
      true,
    );

    // a form inside a dialog: the button follows the fields
    const bar = wrapper.getComponent({ name: "SettingsSaveBar" });
    expect(bar.props("inline")).toBe(true);
    expect(bar.find('[data-testid="config-save"]').exists()).toBe(true);
  });

  it("shows the controls of its host inside the form, above its fields", () => {
    const wrapper = shallowMount(EditConfig, {
      props: {
        configEntries: [entry({ key: "server", type: ConfigEntryType.STRING })],
        disabled: false,
      },
      slots: { default: "<div data-testid='host-control' />" },
      global: { renderStubDefaultSlot: true },
    });

    expect(
      wrapper
        .get("form")
        .element.firstElementChild?.getAttribute("data-testid"),
    ).toBe("host-control");
  });

  it.each([
    { advanced: true, disabled: false, offered: true },
    { advanced: false, disabled: false, offered: false },
    { advanced: true, disabled: true, offered: false },
  ])(
    "offers the advanced toggle for advanced entries: $advanced, disabled: $disabled",
    ({ advanced, disabled, offered }) => {
      const wrapper = mountEntries(
        [
          entry({ key: "server", type: ConfigEntryType.STRING }),
          entry({ key: "port", type: ConfigEntryType.INTEGER, advanced }),
        ],
        disabled,
      );

      expect(wrapper.text()).toContain("settings.options");
      expect(advancedToggle(wrapper).exists()).toBe(offered);
    },
  );

  it("keeps the card with its toggle for a config holding only advanced entries", () => {
    const wrapper = mountEntries([
      entry({ key: "port", type: ConfigEntryType.INTEGER, advanced: true }),
    ]);

    expect(renderedKeys(wrapper)).toEqual([]);
    expect(advancedToggle(wrapper).exists()).toBe(true);
  });

  it("offers saving an advanced-only config once its entries show", async () => {
    const wrapper = mountEntries([
      entry({ key: "port", type: ConfigEntryType.INTEGER, advanced: true }),
    ]);
    const save = () => wrapper.find('[data-testid="config-save"]');
    expect(save().exists()).toBe(false);

    await wrapper.setProps({ showAdvancedSettings: true });
    expect(save().exists()).toBe(true);

    // an edit hidden again by the toggle can still be saved
    edit(wrapper, 0, 9000);
    await wrapper.setProps({ showAdvancedSettings: false });
    expect(renderedKeys(wrapper)).toEqual([]);
    expect(save().exists()).toBe(true);
  });

  it("reveals the advanced entries from its own toggle and remembers the choice", async () => {
    const wrapper = mountEntries([
      entry({ key: "server", type: ConfigEntryType.STRING }),
      entry({ key: "port", type: ConfigEntryType.INTEGER, advanced: true }),
    ]);
    expect(renderedKeys(wrapper)).toEqual(["server"]);

    advancedToggle(wrapper).vm.$emit("update:showAdvancedSettings", true);
    await nextTick();

    expect(renderedKeys(wrapper)).toEqual(["server", "port"]);
    expect(setUserPreference).toHaveBeenCalledWith(
      "settings.showAdvancedSettings",
      true,
    );
  });

  it("shows the advanced entries the user chose to see before", () => {
    storeMock.currentUser = {
      preferences: { "settings.showAdvancedSettings": true },
    };

    const wrapper = mountEntries([
      entry({ key: "server", type: ConfigEntryType.STRING }),
      entry({ key: "port", type: ConfigEntryType.INTEGER, advanced: true }),
    ]);

    expect(renderedKeys(wrapper)).toEqual(["server", "port"]);
    expect(advancedToggle(wrapper).props("showAdvancedSettings")).toBe(true);
  });

  it("shows the advanced entries in expert mode until the user chooses", () => {
    storeMock.currentUser = { preferences: { expert_mode: true } };

    const wrapper = mountEntries([
      entry({ key: "server", type: ConfigEntryType.STRING }),
      entry({ key: "port", type: ConfigEntryType.INTEGER, advanced: true }),
    ]);

    expect(renderedKeys(wrapper)).toEqual(["server", "port"]);
    expect(advancedToggle(wrapper).props("showAdvancedSettings")).toBe(true);
  });

  it("hides the advanced entries in expert mode once the user chose to", () => {
    storeMock.currentUser = {
      preferences: {
        expert_mode: true,
        "settings.showAdvancedSettings": false,
      },
    };

    const wrapper = mountEntries([
      entry({ key: "server", type: ConfigEntryType.STRING }),
      entry({ key: "port", type: ConfigEntryType.INTEGER, advanced: true }),
    ]);

    expect(renderedKeys(wrapper)).toEqual(["server"]);
    expect(advancedToggle(wrapper).props("showAdvancedSettings")).toBe(false);
  });

  it("keeps the choice made here when the profile keeps the old one", async () => {
    // the profile could not be updated, so it still says to hide them
    setUserPreference.mockResolvedValueOnce(false);
    const wrapper = mountEntries([
      entry({ key: "port", type: ConfigEntryType.INTEGER, advanced: true }),
    ]);

    advancedToggle(wrapper).vm.$emit("update:showAdvancedSettings", true);
    await flushPromises();

    expect(renderedKeys(wrapper)).toEqual(["port"]);
  });

  it("lets the host decide over the user's choice", () => {
    storeMock.currentUser = {
      preferences: { "settings.showAdvancedSettings": true },
    };

    const wrapper = shallowMount(EditConfig, {
      props: {
        configEntries: [
          entry({ key: "server", type: ConfigEntryType.STRING }),
          entry({ key: "port", type: ConfigEntryType.INTEGER, advanced: true }),
        ],
        disabled: false,
        showAdvancedSettings: false,
      },
      global: { renderStubDefaultSlot: true },
    });

    expect(renderedKeys(wrapper)).toEqual(["server"]);
  });

  it("offers no toggle when the host decides what shows", () => {
    const wrapper = shallowMount(EditConfig, {
      props: {
        configEntries: [
          entry({ key: "port", type: ConfigEntryType.INTEGER, advanced: true }),
        ],
        disabled: false,
        showAdvancedSettings: true,
      },
      global: { renderStubDefaultSlot: true },
    });

    expect(advancedToggle(wrapper).exists()).toBe(false);
    expect(renderedKeys(wrapper)).toEqual(["port"]);
  });

  it("leaves out its header when the host asks", () => {
    const wrapper = shallowMount(EditConfig, {
      props: {
        configEntries: [
          entry({ key: "port", type: ConfigEntryType.INTEGER, advanced: true }),
        ],
        disabled: false,
        hideHeader: true,
      },
      global: { renderStubDefaultSlot: true },
    });

    expect(wrapper.text()).not.toContain("settings.options");
    expect(advancedToggle(wrapper).exists()).toBe(false);
  });

  it("leaves out the card when the host hides the header and every entry is advanced", () => {
    const wrapper = shallowMount(EditConfig, {
      props: {
        configEntries: [
          entry({ key: "port", type: ConfigEntryType.INTEGER, advanced: true }),
        ],
        disabled: false,
        hideHeader: true,
      },
      global: { renderStubDefaultSlot: true },
    });

    expect(wrapper.findComponent({ name: "Card" }).exists()).toBe(false);
  });

  it("draws no card or title of its own when flat, keeping its advanced toggle and its fields", () => {
    const wrapper = shallowMount(EditConfig, {
      props: {
        configEntries: [
          entry({ key: "server", type: ConfigEntryType.STRING }),
          entry({ key: "port", type: ConfigEntryType.INTEGER, advanced: true }),
        ],
        disabled: false,
        inlineSave: true,
        flat: true,
      },
      global: { renderStubDefaultSlot: true },
    });

    expect(wrapper.findComponent({ name: "Card" }).exists()).toBe(false);
    expect(wrapper.findComponent({ name: "CardHeader" }).exists()).toBe(false);
    expect(wrapper.findComponent({ name: "CardContent" }).exists()).toBe(false);
    expect(wrapper.text()).not.toContain("settings.options");
    expect(advancedToggle(wrapper).exists()).toBe(true);
    expect(renderedKeys(wrapper)).toEqual(["server"]);
  });

  it("offers no save action on a form holding only actions", () => {
    const wrapper = mountEntries([
      entry({ key: "clear_cache", type: ConfigEntryType.ACTION }),
    ]);

    expect(renderedKeys(wrapper)).toEqual(["clear_cache"]);
    expect(wrapper.find('[data-testid="config-save"]').exists()).toBe(false);
  });

  it("offers no save action on a form whose entries save the moment they change", () => {
    const wrapper = mountEntries([
      entry({
        key: "power_controls",
        type: ConfigEntryType.STRING,
        multi_value: true,
        immediate_apply: true,
      }),
      entry({
        key: "mute_controls",
        type: ConfigEntryType.STRING,
        multi_value: true,
        immediate_apply: true,
      }),
    ]);

    expect(renderedKeys(wrapper)).toEqual(["power_controls", "mute_controls"]);
    expect(wrapper.find('[data-testid="config-save"]').exists()).toBe(false);
  });

  it("keeps the save action while an entry waits for it", () => {
    const wrapper = mountEntries([
      entry({
        key: "power_controls",
        type: ConfigEntryType.STRING,
        multi_value: true,
        immediate_apply: true,
      }),
      entry({ key: "host", type: ConfigEntryType.STRING }),
    ]);

    expect(wrapper.find('[data-testid="config-save"]').exists()).toBe(true);
  });

  it("leaves out the card and its save action for a config with nothing to show", () => {
    const wrapper = mountEntries([
      entry({ key: "server", type: ConfigEntryType.STRING, hidden: true }),
    ]);

    expect(wrapper.findComponent({ name: "Card" }).exists()).toBe(false);
    expect(wrapper.find('[data-testid="config-save"]').exists()).toBe(false);
  });

  it("hands the menu of each output on to the protocol section", () => {
    const outputMenuItems = () => [];
    const wrapper = shallowMount(EditConfig, {
      props: {
        configEntries: [
          entry({
            key: "airplay-output||protocol||enabled",
            type: ConfigEntryType.BOOLEAN,
            category: "protocol_airplay",
          }),
        ],
        disabled: false,
        outputMenuItems,
      },
      global: { renderStubDefaultSlot: true },
    });

    expect(
      wrapper
        .findComponent({ name: "ProtocolConfigSection" })
        .props("outputMenuItems"),
    ).toBe(outputMenuItems);
  });
});

describe("EditConfig section headings", () => {
  beforeEach(() => {
    storeMock.currentUser = undefined;
  });

  it("leaves out the heading of the only section", () => {
    const wrapper = mountEntries([
      entry({ key: "server", type: ConfigEntryType.STRING }),
      entry({ key: "port", type: ConfigEntryType.INTEGER }),
    ]);

    expect(sectionHeadings(wrapper)).toEqual([]);
  });

  it("heads every section once there are two", () => {
    const wrapper = mountEntries([
      entry({ key: "server", type: ConfigEntryType.STRING }),
      entry({
        key: "buffer",
        type: ConfigEntryType.INTEGER,
        category: "audio",
      }),
    ]);

    expect(sectionHeadings(wrapper)).toEqual(["generic", "audio"]);
  });

  it("counts no section that holds only hidden entries", () => {
    const wrapper = mountEntries([
      entry({ key: "server", type: ConfigEntryType.STRING }),
      entry({
        key: "buffer",
        type: ConfigEntryType.INTEGER,
        category: "audio",
        hidden: true,
      }),
    ]);

    expect(sectionHeadings(wrapper)).toEqual([]);
  });

  it("heads the sections once the advanced toggle reveals a second one", async () => {
    const wrapper = mountEntries([
      entry({ key: "server", type: ConfigEntryType.STRING }),
      entry({
        key: "buffer",
        type: ConfigEntryType.INTEGER,
        category: "audio",
        advanced: true,
      }),
    ]);
    expect(sectionHeadings(wrapper)).toEqual([]);

    advancedToggle(wrapper).vm.$emit("update:showAdvancedSettings", true);
    await nextTick();

    expect(sectionHeadings(wrapper)).toEqual(["generic", "audio"]);
  });

  it("keeps the heading of the only section when the host names its sections", () => {
    const wrapper = shallowMount(EditConfig, {
      props: {
        configEntries: [entry({ key: "server", type: ConfigEntryType.STRING })],
        disabled: false,
        keepSectionHeadings: true,
      },
      global: { renderStubDefaultSlot: true },
    });

    expect(sectionHeadings(wrapper)).toEqual(["generic"]);
  });

  it("leaves out the heading of the protocol section when it is the only one", () => {
    const wrapper = mountEntries([protocolEnabledEntry()]);

    expect(protocolSection(wrapper).props("showHeading")).toBe(false);
  });

  it("heads the protocol section beside another section", () => {
    const wrapper = mountEntries([
      entry({ key: "server", type: ConfigEntryType.STRING }),
      protocolEnabledEntry(),
    ]);

    expect(protocolSection(wrapper).props("showHeading")).toBe(true);
    expect(sectionHeadings(wrapper)).toEqual(["generic"]);
  });

  it("renders no protocol section for a config without protocols", () => {
    const wrapper = mountEntries([
      entry({ key: "server", type: ConfigEntryType.STRING }),
    ]);

    expect(protocolSection(wrapper).exists()).toBe(false);
  });
});

describe("EditConfig unsaved changes", () => {
  it("carries on to the page the user picked once they discard", async () => {
    const { router, wrapper } = await mountInRouter();
    dirty(wrapper);
    await nextTick();

    // the user picks another entry in the settings menu
    router.push({ name: "music-quiz" });
    await flushPromises();
    expect(router.currentRoute.value.name).toBe("editprovider");

    await click("config-discard");

    expect(router.currentRoute.value.name).toBe("music-quiz");
  });

  it("keeps the user on the form when they choose to stay", async () => {
    const { router, wrapper } = await mountInRouter();
    dirty(wrapper);
    await nextTick();

    router.push({ name: "music-quiz" });
    await flushPromises();
    await click("config-stay");

    expect(router.currentRoute.value.name).toBe("editprovider");
    expect(wrapper.findComponent(EditConfig).exists()).toBe(true);
  });

  // a discarded back has to stay a back, or the form the user just left would
  // sit in the history waiting for the next back press
  it("goes back rather than forward when a back press is discarded", async () => {
    const { router, wrapper } = await mountInRouter();
    dirty(wrapper);
    await nextTick();

    router.back();
    await flushPromises();
    await click("config-discard");
    expect(router.currentRoute.value.name).toBe("settings");

    router.back();
    await flushPromises();

    expect(router.currentRoute.value.name).toBe("players");
  });

  // the router runs the leave guards again for the route it redirects to
  it("asks only once when the page picked redirects elsewhere", async () => {
    const { router, wrapper } = await mountInRouter();
    dirty(wrapper);
    await nextTick();

    router.push({ name: "redirects-away" });
    await flushPromises();
    await click("config-discard");

    expect(router.currentRoute.value.name).toBe("music-quiz");
  });

  // a back press is how a phone dismisses a dialog, and the second one must not
  // leave the history a step away from the page on screen
  it("survives a back press on top of the dialog", async () => {
    const { router, wrapper } = await mountInRouter();
    dirty(wrapper);
    await nextTick();

    router.back();
    await flushPromises();
    router.back();
    await flushPromises();
    await click("config-stay");

    expect(router.currentRoute.value.name).toBe("editprovider");
    expect(router.options.history.location).toBe("/settings/provider");
  });

  // saving lets the screen navigate away without asking, but a save that never
  // landed must not leave the values unguarded
  it("asks again when the host reports a failed save", async () => {
    const { router, wrapper } = await mountInRouter();
    const form = wrapper.findComponent(EditConfig);
    dirty(wrapper);
    await nextTick();

    await form.get('[data-testid="config-save"]').trigger("click");
    await flushPromises();
    form.vm.saveFailed();

    router.push({ name: "music-quiz" });
    await flushPromises();

    expect(router.currentRoute.value.name).toBe("editprovider");
    expect(dialogShown()).toBe(true);
  });

  it("lets the form go once what is on it has been saved", async () => {
    const { router, wrapper } = await mountInRouter();
    const form = wrapper.findComponent(EditConfig);
    dirty(wrapper);
    await nextTick();

    await form.get('[data-testid="config-save"]').trigger("click");
    await flushPromises();
    form.vm.saveSucceeded({ server: "localhost" });

    await router.push({ name: "music-quiz" });

    expect(router.currentRoute.value.name).toBe("music-quiz");
    expect(dialogShown()).toBe(false);
  });

  // a save lets the screen navigate away without asking, and that permission is
  // spent on the values it carried: what is typed afterwards is guarded again
  it("asks again about an edit made after a save", async () => {
    const { router, wrapper } = await mountInRouter();
    const form = wrapper.findComponent(EditConfig);
    dirty(wrapper);
    await nextTick();

    await form.get('[data-testid="config-save"]').trigger("click");
    await flushPromises();
    form.vm.saveSucceeded({ server: "localhost" });
    edit(wrapper, 0, "elsewhere");
    await nextTick();

    router.push({ name: "music-quiz" });
    await flushPromises();

    expect(router.currentRoute.value.name).toBe("editprovider");
    expect(dialogShown()).toBe(true);
  });

  it("lets an unchanged form go without asking", async () => {
    const { router, wrapper } = await mountInRouter();

    await router.push({ name: "music-quiz" });

    expect(router.currentRoute.value.name).toBe("music-quiz");
    expect(dialogShown()).toBe(false);
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
    options: [],
    value: null,
    ...overrides,
  };
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

function mountEntries(
  configEntries: ConfigEntry[],
  disabled = false,
  inlineSave = false,
) {
  return shallowMount(EditConfig, {
    props: { configEntries, disabled, inlineSave },
    global: { renderStubDefaultSlot: true },
  });
}

// the entries of a stereo pair whose first speaker is on the right, with a delay
function stereoPairEntries(): ConfigEntry[] {
  const category = "protocol_sendspin";
  return [
    entry({
      key: "server",
      type: ConfigEntryType.STRING,
      default_value: "localhost",
      value: "elsewhere",
    }),
    // the server sends the state as the default of the label as well
    entry({
      key: "speaker_1_state",
      type: ConfigEntryType.LABEL,
      category,
      default_value: "online",
      value: "online",
    }),
    // the server makes the channel stored the default of the entry
    entry({
      key: "speaker_1_channel_setting",
      type: ConfigEntryType.STRING,
      category,
      options: [
        { title: "Left", value: "front_left" },
        { title: "Right", value: "front_right" },
      ],
      default_value: "front_left",
      value: "front_right",
    }),
    entry({
      key: "speaker_1_output_delay",
      type: ConfigEntryType.INTEGER,
      category,
      default_value: 0,
      value: 40,
    }),
  ];
}

function mountForSave(
  configEntries: ConfigEntry[],
  extraProps: { multiChannel?: boolean } = {},
) {
  return shallowMount(EditConfig, {
    props: { configEntries, disabled: false, ...extraProps },
    global: { renderStubDefaultSlot: true },
  });
}

// the enable switch of an optional protocol, which alone gives a form its protocol section
function protocolEnabledEntry() {
  return entry({
    key: "airplay-output||protocol||enabled",
    type: ConfigEntryType.BOOLEAN,
    category: "protocol_airplay",
  });
}

function sectionHeadings(wrapper: VueWrapper) {
  return wrapper.findAll("section > h4").map((heading) => heading.text());
}

function protocolSection(wrapper: VueWrapper) {
  return wrapper.findComponent({ name: "ProtocolConfigSection" });
}

function advancedToggle(wrapper: VueWrapper) {
  return wrapper.findComponent({ name: "AdvancedSettingsToggle" });
}

function renderedKeys(wrapper: VueWrapper) {
  return wrapper
    .findAllComponents({ name: "ConfigEntryRow" })
    .map((row) => (row.props("confEntry") as ConfigEntry).key);
}

// edits the first entry in place, which is what typing into its field does
function dirty(wrapper: VueWrapper) {
  edit(wrapper, 0, "localhost");
}

function edit(wrapper: VueWrapper, index: number, value: ConfigValueType) {
  const target = wrapper
    .findAllComponents({ name: "ConfigEntryRow" })
    [index].props("confEntry") as ConfigEntry;
  target.value = value;
}

function saveDisabled(wrapper: VueWrapper) {
  const button = wrapper.find('[data-testid="config-save"]');
  if (!button.exists()) throw new Error("save button not rendered");
  return button.attributes("disabled") === "true";
}

// the unsaved-changes guard only runs inside a routed view, so this mounts the
// form the way the settings screens do: as the component of the current route
async function mountInRouter() {
  const configEntries = [
    entry({ key: "server", type: ConfigEntryType.STRING }),
  ];
  const blank = { render: () => h("div") };
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/players", name: "players", component: blank },
      { path: "/settings", name: "settings", component: blank },
      {
        path: "/settings/provider",
        name: "editprovider",
        component: {
          render: () => h(EditConfig, { configEntries, disabled: false }),
        },
      },
      { path: "/music-quiz", name: "music-quiz", component: blank },
      // shaped like the plugin views, which send you away when disabled
      {
        path: "/redirects-away",
        name: "redirects-away",
        component: blank,
        beforeEnter: () => ({ name: "music-quiz" }),
      },
    ],
  });
  router.push({ name: "players" });
  await router.isReady();
  await router.push({ name: "settings" });
  await router.push({ name: "editprovider" });

  // the dialog teleports to the body, so the form lives in the document too
  const wrapper = mount(
    { render: () => h(RouterView) },
    {
      attachTo: document.body,
      global: {
        plugins: [router],
        stubs: {
          ConfigEntryRow: true,
          ProtocolConfigSection: true,
        },
      },
    },
  );
  await flushPromises();
  return { router, wrapper };
}

// answering the dialog releases a navigation, so settle that too
async function click(testId: string) {
  const button = document.querySelector<HTMLElement>(
    `[data-testid="${testId}"]`,
  );
  if (!button) throw new Error(`${testId} not rendered`);
  button.click();
  await flushPromises();
}

function dialogShown() {
  return !!document.querySelector('[data-testid="config-discard"]');
}
