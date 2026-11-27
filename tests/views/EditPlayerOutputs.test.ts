import type { ConfigEntryUI } from "@/helpers/config_entry_ui";
import type { ContextMenuItem } from "@/helpers/context_menu_item";
import type { getOutputMenuItems as buildOutputMenuItems } from "@/helpers/player_settings_actions";
import type { MusicAssistantApi } from "@/plugins/api";
import { ApiCommandError } from "@/plugins/api/errors";
import {
  ChannelLayout,
  ConfigEntryType,
  EventType,
  PlayerType,
  ProtocolRole,
  ProviderFeature,
  SpeakerChannel,
  type ConfigEntry,
  type OutputProtocol,
  type PlayerConfig,
} from "@/plugins/api/interfaces";
import EditConfig from "@/views/settings/EditConfig.vue";
import EditPlayerOutputs from "@/views/settings/EditPlayerOutputs.vue";
import {
  enableAutoUnmount,
  flushPromises,
  shallowMount,
  type VueWrapper,
} from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AIRPLAY_OUTPUT_ID,
  playerSettingsConfig,
  playerSettingsOutputs,
  SENDSPIN_OUTPUT_ID,
} from "../fixtures/playerSettingsConfig";

const {
  apiMock,
  editConfigDiscardMock,
  editConfigSaveFailedMock,
  getOutputMenuItems,
  isPlayerBeingRemoved,
  routerMock,
} = vi.hoisted(() => ({
  apiMock: {
    getMultiChannelCandidates:
      vi.fn<MusicAssistantApi["getMultiChannelCandidates"]>(),
    getMultiChannelLayouts:
      vi.fn<MusicAssistantApi["getMultiChannelLayouts"]>(),
    getPlayerConfig: vi.fn<MusicAssistantApi["getPlayerConfig"]>(),
    getProvider: vi.fn<MusicAssistantApi["getProvider"]>(),
    players: {} as Record<string, unknown>,
    providers: {} as Record<string, unknown>,
    savePlayerConfig: vi.fn<MusicAssistantApi["savePlayerConfig"]>(),
    serverInfo: { value: undefined as { server_version: string } | undefined },
    subscribe: vi.fn(),
  },
  editConfigDiscardMock: vi.fn(),
  editConfigSaveFailedMock: vi.fn(),
  getOutputMenuItems: vi.fn<typeof buildOutputMenuItems>(),
  isPlayerBeingRemoved: vi.fn<(playerId: string) => boolean>(),
  routerMock: {
    back: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
    // no page to go back to, so leaving the page takes the fallback route
    options: { history: { state: { back: null as string | null } } },
  },
}));

const EditConfigStub = {
  name: "EditConfig",
  props: [
    "configEntries",
    "disabled",
    "multiChannel",
    "outputMenuItems",
    "outputProtocols",
  ],
  methods: {
    discardChanges: editConfigDiscardMock,
    saveFailed: editConfigSaveFailedMock,
  },
  template: "<div />",
};

vi.mock("@/plugins/api", () => ({
  api: apiMock,
  default: apiMock,
}));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

vi.mock("@/plugins/store", () => ({
  store: {
    frameless: false,
    mobileLayout: false,
    roleScopes: {},
    currentUser: undefined,
  },
}));

// the menus are covered where they are built
vi.mock("@/helpers/player_settings_actions", () => ({
  getOutputMenuItems,
  isPlayerBeingRemoved,
}));

vi.mock("vue-sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("vue-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("vue-router")>();
  return { ...actual, useRouter: () => routerMock };
});

// the layouts of the Sendspin provider, as the server lists them
const LAYOUTS = {
  [ChannelLayout.STEREO]: [
    SpeakerChannel.FRONT_LEFT,
    SpeakerChannel.FRONT_RIGHT,
  ],
};

const OUTPUT_KEYS = [
  "preferred_output_protocol",
  "output_codec",
  "flow_mode",
  "output_channels",
  `${AIRPLAY_OUTPUT_ID}||protocol||enabled`,
  `${AIRPLAY_OUTPUT_ID}||protocol||sync_adjust`,
  `${AIRPLAY_OUTPUT_ID}||protocol||output_channels`,
  `${SENDSPIN_OUTPUT_ID}||protocol||enabled`,
  `${SENDSPIN_OUTPUT_ID}||protocol||output_channels`,
];

describe("EditPlayerOutputs", () => {
  // the api mock is a module singleton, so a component left mounted keeps
  // answering the next test's events
  enableAutoUnmount(afterEach);

  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.subscribe.mockReturnValue(vi.fn());
    apiMock.getPlayerConfig.mockResolvedValue(playerSettingsConfig());
    apiMock.savePlayerConfig.mockResolvedValue(playerSettingsConfig());
    apiMock.players = { kitchen: playerState() };
    apiMock.providers = {};
    apiMock.serverInfo.value = undefined;
    routerMock.options.history.state.back = null;
    getOutputMenuItems.mockReturnValue([]);
    isPlayerBeingRemoved.mockReturnValue(false);
  });

  it("names the player in the header and links the docs of the outputs", async () => {
    const header = (await mountPage()).findComponent({
      name: "SettingsHeaderCard",
    });

    expect(header.props()).toMatchObject({
      title: "settings.category.protocol_settings",
      description: "Kitchen",
      documentationUrl:
        "https://music-assistant.io/settings/individual-player/#output-protocols",
      resetDisabled: false,
    });
  });

  it("keeps the reset out of reach while the player is disabled", async () => {
    apiMock.getPlayerConfig.mockResolvedValue(
      playerSettingsConfig({ enabled: false }),
    );

    const header = (await mountPage()).findComponent({
      name: "SettingsHeaderCard",
    });

    expect(header.props("resetDisabled")).toBe(true);
  });

  it("shows the preferred output and the settings of each output only", async () => {
    const wrapper = await mountPage();

    expect(formEntries(wrapper).map((entry) => entry.key)).toEqual(OUTPUT_KEYS);
    expect(
      wrapper.findComponent({ name: "EditConfig" }).props("outputProtocols"),
    ).toEqual(playerSettingsOutputs());
  });

  it("saves the settings of the outputs only and goes back to the player", async () => {
    const wrapper = await mountPage({ realForm: true });
    const form = wrapper.findComponent(EditConfig);
    formEntry(form, `${AIRPLAY_OUTPUT_ID}||protocol||sync_adjust`).value = 40;

    await form.vm.submit();
    await flushPromises();

    const [playerId, values] = apiMock.savePlayerConfig.mock.lastCall!;
    expect(playerId).toBe("kitchen");
    expect(Object.keys(values)).toEqual(OUTPUT_KEYS);
    expect(values[`${AIRPLAY_OUTPUT_ID}||protocol||sync_adjust`]).toBe(40);
    // opened directly, so there is no page to go back to
    expect(routerMock.push).toHaveBeenCalledWith({
      name: "editplayer",
      params: { playerId: "kitchen" },
    });
  });

  it("goes back to where the user came from after a save", async () => {
    routerMock.options.history.state.back = "/settings/editplayer/kitchen";
    const wrapper = await mountPage();

    wrapper.findComponent({ name: "EditConfig" }).vm.$emit("submit", {});
    await flushPromises();

    expect(routerMock.back).toHaveBeenCalledOnce();
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it("stays on the form when the server refuses the save", async () => {
    apiMock.savePlayerConfig.mockRejectedValueOnce(
      new ApiCommandError("Refused", 1, "Refused"),
    );
    const wrapper = await mountPage();

    wrapper.findComponent({ name: "EditConfig" }).vm.$emit("submit", {});
    await flushPromises();

    expect(editConfigSaveFailedMock).toHaveBeenCalledOnce();
    expect(routerMock.push).not.toHaveBeenCalled();
    expect(routerMock.back).not.toHaveBeenCalled();
  });

  it("keeps the form closed while the player is disabled", async () => {
    apiMock.getPlayerConfig.mockResolvedValue(
      playerSettingsConfig({ enabled: false }),
    );

    const wrapper = await mountPage();

    expect(
      wrapper.findComponent({ name: "EditConfig" }).props("disabled"),
    ).toBe(true);
  });

  it("offers the menu of each output in the form", async () => {
    const splitOffItem = { label: "settings.split_off_output" };
    getOutputMenuItems.mockReturnValue([splitOffItem]);
    const output = playerSettingsOutputs()[1];
    const wrapper = await mountPage();

    expect(outputMenuItems(wrapper, output)).toEqual([splitOffItem]);
    expect(getOutputMenuItems).toHaveBeenCalledWith(
      expect.objectContaining({ player_id: "kitchen" }),
      output,
      expect.objectContaining({ onSplitOff: expect.any(Function) }),
    );
  });

  it("hands the speakers the server lists to the output menus", async () => {
    apiMock.players = {
      kitchen: {
        ...playerState(),
        protocols: [
          {
            protocol_id: "client-1",
            domain: "sendspin",
            provider: "sendspin",
            role: ProtocolRole.NATIVE,
            available: true,
            active: false,
          },
        ],
      },
    };
    apiMock.getProvider.mockReturnValue({
      supported_features: [ProviderFeature.CREATE_MULTI_CHANNEL_PLAYER],
    } as never);
    apiMock.getMultiChannelCandidates.mockResolvedValue(["kitchen"]);
    apiMock.getMultiChannelLayouts.mockResolvedValue(LAYOUTS);
    const wrapper = await mountPage();

    outputMenuItems(wrapper, playerSettingsOutputs()[0]);

    expect(apiMock.getMultiChannelCandidates).toHaveBeenCalledWith("sendspin", {
      suppressGlobalError: true,
    });
    expect(getOutputMenuItems.mock.lastCall?.[2]).toMatchObject({
      multiChannelCandidates: { sendspin: ["kitchen"] },
      multiChannelLayouts: { sendspin: LAYOUTS },
    });
  });

  it("goes to the multi-channel player an output moved into", async () => {
    const wrapper = await mountPage();
    outputMenuItems(wrapper, playerSettingsOutputs()[0]);

    getOutputMenuItems.mock.calls[0][2]!.onMultiChannelCreated!("studio");

    // this player may be gone, so its pending edits have nothing to go to
    expect(editConfigDiscardMock).toHaveBeenCalledOnce();
    expect(routerMock.replace).toHaveBeenCalledWith(
      "/settings/editplayer/studio",
    );
  });

  it("starts the form over from what is stored once an output is split off", async () => {
    const wrapper = await mountPage();
    outputMenuItems(wrapper, playerSettingsOutputs()[1]);

    getOutputMenuItems.mock.calls[0][2]!.onSplitOff!();
    await flushPromises();

    // the server reset the choices that named the output, so pending edits go
    expect(editConfigDiscardMock).toHaveBeenCalledOnce();
    expect(apiMock.getPlayerConfig).toHaveBeenCalledTimes(2);
    expect(wrapper.findComponent({ name: "EditConfig" }).exists()).toBe(true);
  });

  it("keeps the channels swapped but not saved when an output delay applies at once", async () => {
    apiMock.getPlayerConfig.mockResolvedValue(stereoPairConfig());
    const wrapper = await mountPage();
    const editConfig = wrapper.findComponent({ name: "EditConfig" });
    // the form holds the swap as a draft, and saves the delay at once
    formEntry(editConfig, "speaker_1_channel_setting").value = "front_right";
    formEntry(editConfig, "speaker_2_channel_setting").value = "front_left";
    formEntry(editConfig, "speaker_1_output_delay").value = 40;
    apiMock.savePlayerConfig.mockResolvedValueOnce(
      stereoPairConfig({ delay: 40 }),
    );

    editConfig.vm.$emit("immediateApply", { speaker_1_output_delay: 40 });
    await flushPromises();

    expect(apiMock.savePlayerConfig).toHaveBeenCalledWith("kitchen", {
      speaker_1_output_delay: 40,
    });
    expect(formValues(editConfig)).toMatchObject({
      speaker_1_channel_setting: "front_right",
      speaker_2_channel_setting: "front_left",
      speaker_1_output_delay: 40,
    });

    // the save that follows still holds the swap, and the delay
    editConfig.vm.$emit("submit", formValues(editConfig));
    await flushPromises();
    expect(apiMock.savePlayerConfig).toHaveBeenLastCalledWith(
      "kitchen",
      expect.objectContaining({
        speaker_1_channel_setting: "front_right",
        speaker_2_channel_setting: "front_left",
        speaker_1_output_delay: 40,
      }),
    );
  });

  it("shows the speakers of a multi-channel player as rows", async () => {
    apiMock.getPlayerConfig.mockResolvedValue(stereoPairConfig());
    apiMock.players = {
      kitchen: { ...playerState(), type: PlayerType.MULTI_CHANNEL },
    };

    const wrapper = await mountPage();

    expect(
      wrapper.findComponent({ name: "EditConfig" }).props("multiChannel"),
    ).toBe(true);
  });

  it("shows no speaker rows for any other player", async () => {
    const wrapper = await mountPage();

    expect(
      wrapper.findComponent({ name: "EditConfig" }).props("multiChannel"),
    ).toBe(false);
  });

  it("shows the state of a speaker the server reports on a refresh", async () => {
    apiMock.getPlayerConfig.mockResolvedValueOnce(stereoPairConfig());
    const wrapper = await mountPage();
    const editConfig = wrapper.findComponent({ name: "EditConfig" });
    expect(formEntry(editConfig, "speaker_2_state").value).toBe("online");
    apiMock.getPlayerConfig.mockResolvedValueOnce(
      stereoPairConfig({ state: "offline" }),
    );

    deliver(EventType.PROVIDERS_UPDATED);
    await flushPromises();

    expect(formEntry(editConfig, "speaker_2_state").value).toBe("offline");
  });

  it("leaves to the players list once the server removed the player", async () => {
    await mountPage();

    deliver(EventType.PLAYER_REMOVED, "kitchen");

    // pending edits have nothing left to save to
    expect(editConfigDiscardMock).toHaveBeenCalledOnce();
    expect(routerMock.replace).toHaveBeenCalledWith({ name: "playersettings" });
  });

  it("leaves the way out to a command of this app that removes the player", async () => {
    await mountPage();
    isPlayerBeingRemoved.mockImplementation((id) => id === "kitchen");

    deliver(EventType.PLAYER_REMOVED, "kitchen");
    deliver(EventType.PLAYER_REMOVED, "attic");

    expect(routerMock.replace).not.toHaveBeenCalled();
  });
});

/**
 * The config of a stereo pair: the entries of its speakers on its Sendspin protocol,
 * with the given state of its second speaker and output delay of its first one.
 */
function stereoPairConfig({
  state = "online",
  delay = 0,
}: { state?: string; delay?: number } = {}): PlayerConfig {
  const category = "protocol_sendspin";
  const speakerEntry = (
    key: string,
    overrides: Partial<ConfigEntry>,
  ): [string, ConfigEntry] => [
    key,
    {
      key,
      type: ConfigEntryType.STRING,
      label: key,
      category,
      options: [],
      required: false,
      default_value: null,
      ...overrides,
    },
  ];
  const config = playerSettingsConfig();
  return {
    ...config,
    player_type: PlayerType.MULTI_CHANNEL,
    values: {
      ...config.values,
      ...Object.fromEntries(
        [1, 2].flatMap((number) => [
          speakerEntry(`speaker_${number}_state`, {
            type: ConfigEntryType.LABEL,
            value: number === 2 ? state : "online",
          }),
          speakerEntry(`speaker_${number}_display_name`, {
            type: ConfigEntryType.LABEL,
            label: "Speaker",
            value: number === 1 ? "Studio left" : "Studio right",
          }),
          speakerEntry(`speaker_${number}_channel_setting`, {
            value: number === 1 ? "front_left" : "front_right",
          }),
          speakerEntry(`speaker_${number}_output_delay`, {
            type: ConfigEntryType.INTEGER,
            immediate_apply: true,
            value: number === 1 ? delay : 0,
          }),
        ]),
      ),
    },
  };
}

function playerState() {
  return {
    available: true,
    device_info: { manufacturer: "", model: "", identifiers: {} },
    enabled: true,
    name: "Kitchen",
    options: [],
    output_protocols: playerSettingsOutputs(),
    player_id: "kitchen",
    protocols: [],
    supported_features: [],
    type: PlayerType.PLAYER,
  };
}

// the form, as the stub or as itself, with the entries the page hands it
interface FormWrapper {
  props(name: "configEntries"): unknown;
}

function formEntries(wrapper: VueWrapper): ConfigEntryUI[] {
  return wrapper
    .findComponent({ name: "EditConfig" })
    .props("configEntries") as ConfigEntryUI[];
}

function formEntry(form: FormWrapper, key: string): ConfigEntry {
  const found = (form.props("configEntries") as ConfigEntry[]).find(
    (entry) => entry.key === key,
  );
  if (!found) throw new Error(`The form has no ${key} entry`);
  return found;
}

/** The values of the form, as it hands them to a save. */
function formValues(form: FormWrapper): Record<string, unknown> {
  return Object.fromEntries(
    (form.props("configEntries") as ConfigEntryUI[])
      .filter((entry) => !entry.injected)
      .map((entry) => [entry.key, entry.value]),
  );
}

/**
 * The menu the page offers for an output, through the form that shows it.
 */
function outputMenuItems(
  wrapper: VueWrapper,
  output: OutputProtocol,
): ContextMenuItem[] {
  const getMenuItems = wrapper
    .findComponent({ name: "EditConfig" })
    .props("outputMenuItems") as (output: OutputProtocol) => ContextMenuItem[];
  return getMenuItems(output);
}

/**
 * Deliver an event the page listens for.
 */
function deliver(eventType: EventType, objectId?: string) {
  for (const [subscribed, callback] of apiMock.subscribe.mock.calls) {
    if (subscribed === eventType) callback({ object_id: objectId });
  }
}

async function mountPage({ realForm = false } = {}) {
  const wrapper = shallowMount(EditPlayerOutputs, {
    props: { playerId: "kitchen" },
    global: {
      mocks: { $t: (key: string) => key },
      stubs: { EditConfig: realForm ? false : EditConfigStub },
    },
  });
  await flushPromises();
  return wrapper;
}
