import ShowDashboardButton from "@/components/ShowDashboardButton.vue";
import {
  EventType,
  PlaybackState,
  type EventMessage,
  type Player,
  type ProviderInstance,
} from "@/plugins/api/interfaces";
import { Check } from "@lucide/vue";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiMock, isDashboardViewerMock, toastMock } = vi.hoisted(() => ({
  apiMock: {
    providers: {} as Record<string, ProviderInstance>,
    players: {} as Record<string, Player>,
    sendCommand: vi.fn(),
    subscribe: vi.fn(),
  },
  isDashboardViewerMock: vi.fn(() => false),
  toastMock: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/plugins/api", () => ({
  default: apiMock,
}));

vi.mock("@/plugins/auth", () => ({
  authManager: {
    isDashboardViewer: isDashboardViewerMock,
  },
}));

vi.mock("vue-sonner", () => ({
  toast: toastMock,
}));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string, values: unknown[] = []) =>
    values.length ? `${key}:${values.join(",")}` : key,
}));

const CHROMECAST_PROVIDER = {
  type: "plugin",
  domain: "chromecast",
  name: "Chromecast",
  default_name: "Chromecast",
  instance_id: "chromecast_1",
  supported_features: [],
  available: true,
} as unknown as ProviderInstance;

// Command responses are keyed by command name; anything not overridden here
// falls back to an empty sessions list / undefined, matching the "no active
// session" default most tests want.
function mockCommands(overrides: Record<string, () => unknown> = {}) {
  apiMock.sendCommand.mockImplementation((command: string) => {
    if (command in overrides) {
      try {
        return Promise.resolve(overrides[command]!());
      } catch (error) {
        return Promise.reject(error);
      }
    }
    if (command === "dashboard/sessions" || command === "dashboard/devices") {
      return Promise.resolve([]);
    }
    return Promise.resolve(undefined);
  });
}

// Captures the callback passed to api.subscribe so a test can fire a fake
// dashboard_sessions_updated event, mirroring the real event bus.
function captureSubscription() {
  let callback: ((evt: EventMessage) => void) | undefined;
  apiMock.subscribe.mockImplementation(
    (_eventType: EventType, cb: (evt: EventMessage) => void) => {
      callback = cb;
      return vi.fn();
    },
  );
  return {
    emit: (data: unknown) => callback?.({ event: EventType.ALL, data }),
  };
}

function mountButton(path = "/party") {
  const passthroughStub = { template: "<div><slot /></div>" };
  return mount(ShowDashboardButton, {
    props: { path },
    global: {
      stubs: {
        DropdownMenu: passthroughStub,
        DropdownMenuContent: passthroughStub,
        DropdownMenuTrigger: passthroughStub,
        DropdownMenuSeparator: { template: "<hr />" },
        DropdownMenuItem: {
          props: ["variant"],
          emits: ["click"],
          template:
            '<button data-testid="cast-dashboard-device" :data-variant="variant" @click="$emit(\'click\')"><slot /></button>',
        },
        ProviderIcon: {
          props: ["domain"],
          template:
            '<span data-testid="cast-dashboard-provider-icon" :data-domain="domain"></span>',
        },
      },
    },
  });
}

describe("ShowDashboardButton", () => {
  beforeEach(() => {
    for (const key of Object.keys(apiMock.providers)) {
      delete apiMock.providers[key];
    }
    for (const key of Object.keys(apiMock.players)) {
      delete apiMock.players[key];
    }
    apiMock.sendCommand.mockReset();
    apiMock.subscribe.mockReset();
    apiMock.subscribe.mockImplementation(() => vi.fn());
    mockCommands();
    isDashboardViewerMock.mockReset();
    isDashboardViewerMock.mockReturnValue(false);
    toastMock.success.mockReset();
    toastMock.error.mockReset();
  });

  it("renders nothing when the chromecast provider isn't loaded", () => {
    const wrapper = mountButton();
    expect(wrapper.find("button").exists()).toBe(false);
  });

  it("renders nothing for a dashboard viewer session even if chromecast is loaded", () => {
    apiMock.providers[CHROMECAST_PROVIDER.instance_id] = CHROMECAST_PROVIDER;
    isDashboardViewerMock.mockReturnValue(true);

    const wrapper = mountButton();
    expect(wrapper.find("button").exists()).toBe(false);
  });

  it("loads and lists cast devices when opened, annotating ones playing MA audio", async () => {
    apiMock.providers[CHROMECAST_PROVIDER.instance_id] = CHROMECAST_PROVIDER;
    apiMock.players["device-1"] = {
      player_id: "device-1",
      playback_state: PlaybackState.PLAYING,
    } as Player;
    mockCommands({
      "dashboard/devices": () => [
        {
          device_id: "device-1",
          provider_instance: "chromecast_1",
          name: "Living Room TV",
          player_id: "device-1",
        },
        {
          device_id: "device-2",
          provider_instance: "chromecast_1",
          name: "Bedroom TV",
          player_id: null,
        },
      ],
    });

    const wrapper = mountButton();
    await wrapper.get("button").trigger("click");
    await flushAsync();

    expect(apiMock.sendCommand).toHaveBeenCalledWith("dashboard/devices");
    const devices = wrapper.findAll('[data-testid="cast-dashboard-device"]');
    expect(devices).toHaveLength(2);
    expect(devices[0]!.text()).toContain("Living Room TV");
    expect(devices[0]!.text()).toContain("dashboard.playing_hint");
    expect(devices[1]!.text()).toContain("Bedroom TV");
    expect(devices[1]!.text()).not.toContain("dashboard.playing_hint");
  });

  it("shows a provider icon per device, skipping it for an unknown provider instance", async () => {
    apiMock.providers[CHROMECAST_PROVIDER.instance_id] = CHROMECAST_PROVIDER;
    mockCommands({
      "dashboard/devices": () => [
        {
          device_id: "device-1",
          provider_instance: "chromecast_1",
          name: "Living Room TV",
          player_id: null,
        },
        {
          device_id: "device-2",
          provider_instance: "unloaded_provider",
          name: "Stale Device",
          player_id: null,
        },
      ],
    });

    const wrapper = mountButton();
    await wrapper.get("button").trigger("click");
    await flushAsync();

    const devices = wrapper.findAll('[data-testid="cast-dashboard-device"]');
    const icons = (device: (typeof devices)[number]) =>
      device.findAll('[data-testid="cast-dashboard-provider-icon"]');
    expect(icons(devices[0]!)).toHaveLength(1);
    expect(icons(devices[0]!)[0]!.attributes("data-domain")).toBe(
      "chromecast_1",
    );
    expect(icons(devices[1]!)).toHaveLength(0);
  });

  it("starts the dashboard on the selected device and toasts success", async () => {
    apiMock.providers[CHROMECAST_PROVIDER.instance_id] = CHROMECAST_PROVIDER;
    mockCommands({
      "dashboard/devices": () => [
        {
          device_id: "device-1",
          provider_instance: "chromecast_1",
          name: "Kitchen",
          player_id: null,
        },
      ],
    });

    const wrapper = mountButton("/music-quiz");
    await wrapper.get("button").trigger("click");
    await flushAsync();

    await wrapper.get('[data-testid="cast-dashboard-device"]').trigger("click");
    await flushAsync();

    expect(apiMock.sendCommand).not.toHaveBeenCalledWith(
      "dashboard/hide",
      expect.anything(),
    );
    expect(apiMock.sendCommand).toHaveBeenCalledWith("dashboard/show", {
      provider_instance: "chromecast_1",
      device_id: "device-1",
      path: "/music-quiz",
    });
    expect(toastMock.success).toHaveBeenCalledWith("dashboard.started:Kitchen");
  });

  it("leaves error toasting to the global command handler on failure", async () => {
    apiMock.providers[CHROMECAST_PROVIDER.instance_id] = CHROMECAST_PROVIDER;
    mockCommands({
      "dashboard/devices": () => [
        {
          device_id: "device-1",
          provider_instance: "chromecast_1",
          name: "Kitchen",
          player_id: null,
        },
      ],
      "dashboard/show": () => {
        throw new Error("Remote access disabled");
      },
    });

    const wrapper = mountButton();
    await wrapper.get("button").trigger("click");
    await flushAsync();
    await wrapper.get('[data-testid="cast-dashboard-device"]').trigger("click");
    await flushAsync();

    expect(toastMock.success).not.toHaveBeenCalled();
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it("fetches sessions on mount and shows the icon in the active color when one matches this path", async () => {
    apiMock.providers[CHROMECAST_PROVIDER.instance_id] = CHROMECAST_PROVIDER;
    mockCommands({
      "dashboard/sessions": () => [
        {
          device_id: "device-1",
          provider_instance: "chromecast_1",
          path: "/party",
        },
      ],
    });

    const wrapper = mountButton("/party");
    await flushAsync();

    expect(apiMock.sendCommand).toHaveBeenCalledWith("dashboard/sessions");
    expect(wrapper.get("button").classes()).toContain("bg-primary");
  });

  it("does not color the icon when the active session is for a different path", async () => {
    apiMock.providers[CHROMECAST_PROVIDER.instance_id] = CHROMECAST_PROVIDER;
    mockCommands({
      "dashboard/sessions": () => [
        {
          device_id: "device-1",
          provider_instance: "chromecast_1",
          path: "/music-quiz",
        },
      ],
    });

    const wrapper = mountButton("/party");
    await flushAsync();

    expect(wrapper.get("button").classes()).not.toContain("bg-primary");
  });

  it("updates active state when a dashboard_sessions_updated event arrives", async () => {
    apiMock.providers[CHROMECAST_PROVIDER.instance_id] = CHROMECAST_PROVIDER;
    mockCommands();
    const subscription = captureSubscription();

    const wrapper = mountButton("/party");
    await flushAsync();

    expect(apiMock.subscribe).toHaveBeenCalledWith(
      EventType.DASHBOARD_SESSIONS_UPDATED,
      expect.any(Function),
    );
    expect(wrapper.get("button").classes()).not.toContain("bg-primary");

    subscription.emit([
      {
        device_id: "device-1",
        provider_instance: "chromecast_1",
        path: "/party",
      },
    ]);
    await flushAsync();

    expect(wrapper.get("button").classes()).toContain("bg-primary");
  });

  it("marks the active device with a check and offers a disconnect item", async () => {
    apiMock.providers[CHROMECAST_PROVIDER.instance_id] = CHROMECAST_PROVIDER;
    mockCommands({
      "dashboard/sessions": () => [
        {
          device_id: "device-1",
          provider_instance: "chromecast_1",
          path: "/party",
        },
      ],
      "dashboard/devices": () => [
        {
          device_id: "device-1",
          provider_instance: "chromecast_1",
          name: "Living Room TV",
          player_id: null,
        },
        {
          device_id: "device-2",
          provider_instance: "chromecast_1",
          name: "Bedroom TV",
          player_id: null,
        },
      ],
    });

    const wrapper = mountButton("/party");
    await flushAsync();
    await wrapper.get("button").trigger("click");
    await flushAsync();

    const devices = wrapper.findAll('[data-testid="cast-dashboard-device"]');
    expect(devices[0]!.findComponent(Check).exists()).toBe(true);
    expect(devices[1]!.findComponent(Check).exists()).toBe(false);

    const disconnect = wrapper.get('[data-testid="cast-dashboard-disconnect"]');
    expect(disconnect.attributes("data-variant")).toBe("destructive");
  });

  it("disconnect stops the active session and optimistically clears the active icon", async () => {
    apiMock.providers[CHROMECAST_PROVIDER.instance_id] = CHROMECAST_PROVIDER;
    mockCommands({
      "dashboard/sessions": () => [
        {
          device_id: "device-1",
          provider_instance: "chromecast_1",
          path: "/party",
        },
      ],
    });

    const wrapper = mountButton("/party");
    await flushAsync();
    await wrapper.get("button").trigger("click");
    await flushAsync();

    await wrapper
      .get('[data-testid="cast-dashboard-disconnect"]')
      .trigger("click");
    await flushAsync();

    expect(apiMock.sendCommand).toHaveBeenCalledWith("dashboard/hide", {
      provider_instance: "chromecast_1",
      device_id: "device-1",
    });
    expect(wrapper.get("button").classes()).not.toContain("bg-primary");
  });

  it("selecting a different device hides the current session before showing the new one", async () => {
    apiMock.providers[CHROMECAST_PROVIDER.instance_id] = CHROMECAST_PROVIDER;
    mockCommands({
      "dashboard/sessions": () => [
        {
          device_id: "device-1",
          provider_instance: "chromecast_1",
          path: "/party",
        },
      ],
      "dashboard/devices": () => [
        {
          device_id: "device-1",
          provider_instance: "chromecast_1",
          name: "Living Room TV",
          player_id: null,
        },
        {
          device_id: "device-2",
          provider_instance: "chromecast_1",
          name: "Bedroom TV",
          player_id: null,
        },
      ],
    });

    const wrapper = mountButton("/party");
    await flushAsync();
    await wrapper.get("button").trigger("click");
    await flushAsync();

    const devices = wrapper.findAll('[data-testid="cast-dashboard-device"]');
    await devices[1]!.trigger("click"); // Bedroom TV, currently inactive
    await flushAsync();

    const commandNames = apiMock.sendCommand.mock.calls.map((call) => call[0]);
    const hideIndex = commandNames.lastIndexOf("dashboard/hide");
    const showIndex = commandNames.lastIndexOf("dashboard/show");
    expect(hideIndex).toBeGreaterThanOrEqual(0);
    expect(showIndex).toBeGreaterThan(hideIndex);
    expect(apiMock.sendCommand).toHaveBeenCalledWith("dashboard/hide", {
      provider_instance: "chromecast_1",
      device_id: "device-1",
    });
    expect(apiMock.sendCommand).toHaveBeenCalledWith("dashboard/show", {
      provider_instance: "chromecast_1",
      device_id: "device-2",
      path: "/party",
    });
  });

  it("clicking the already-active device is a no-op", async () => {
    apiMock.providers[CHROMECAST_PROVIDER.instance_id] = CHROMECAST_PROVIDER;
    mockCommands({
      "dashboard/sessions": () => [
        {
          device_id: "device-1",
          provider_instance: "chromecast_1",
          path: "/party",
        },
      ],
      "dashboard/devices": () => [
        {
          device_id: "device-1",
          provider_instance: "chromecast_1",
          name: "Living Room TV",
          player_id: null,
        },
      ],
    });

    const wrapper = mountButton("/party");
    await flushAsync();
    await wrapper.get("button").trigger("click");
    await flushAsync();
    apiMock.sendCommand.mockClear();

    await wrapper.get('[data-testid="cast-dashboard-device"]').trigger("click");
    await flushAsync();

    expect(apiMock.sendCommand).not.toHaveBeenCalledWith(
      "dashboard/hide",
      expect.anything(),
    );
    expect(apiMock.sendCommand).not.toHaveBeenCalledWith(
      "dashboard/show",
      expect.anything(),
    );
  });
});

async function flushAsync() {
  await Promise.resolve();
  await Promise.resolve();
}
