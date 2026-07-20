import CastDashboardButton from "@/components/CastDashboardButton.vue";
import {
  PlaybackState,
  type Player,
  type ProviderInstance,
} from "@/plugins/api/interfaces";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiMock, isCastViewerMock, toastMock } = vi.hoisted(() => ({
  apiMock: {
    providers: {} as Record<string, ProviderInstance>,
    players: {} as Record<string, Player>,
    sendCommand: vi.fn(),
  },
  isCastViewerMock: vi.fn(() => false),
  toastMock: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/plugins/api", () => ({
  default: apiMock,
}));

vi.mock("@/plugins/auth", () => ({
  authManager: {
    isCastViewer: isCastViewerMock,
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

function mountButton(path = "/party") {
  const passthroughStub = { template: "<div><slot /></div>" };
  return mount(CastDashboardButton, {
    props: { path },
    global: {
      stubs: {
        DropdownMenu: passthroughStub,
        DropdownMenuContent: passthroughStub,
        DropdownMenuTrigger: passthroughStub,
        DropdownMenuItem: {
          emits: ["click"],
          template:
            '<button data-testid="cast-dashboard-device" @click="$emit(\'click\')"><slot /></button>',
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

describe("CastDashboardButton", () => {
  beforeEach(() => {
    for (const key of Object.keys(apiMock.providers)) {
      delete apiMock.providers[key];
    }
    for (const key of Object.keys(apiMock.players)) {
      delete apiMock.players[key];
    }
    apiMock.sendCommand.mockReset();
    isCastViewerMock.mockReset();
    isCastViewerMock.mockReturnValue(false);
    toastMock.success.mockReset();
    toastMock.error.mockReset();
  });

  it("renders nothing when the chromecast provider isn't loaded", () => {
    const wrapper = mountButton();
    expect(wrapper.find("button").exists()).toBe(false);
  });

  it("renders nothing for a cast viewer session even if chromecast is loaded", () => {
    apiMock.providers[CHROMECAST_PROVIDER.instance_id] = CHROMECAST_PROVIDER;
    isCastViewerMock.mockReturnValue(true);

    const wrapper = mountButton();
    expect(wrapper.find("button").exists()).toBe(false);
  });

  it("loads and lists cast devices when opened, annotating ones playing MA audio", async () => {
    apiMock.providers[CHROMECAST_PROVIDER.instance_id] = CHROMECAST_PROVIDER;
    apiMock.players["device-1"] = {
      player_id: "device-1",
      playback_state: PlaybackState.PLAYING,
    } as Player;
    apiMock.sendCommand.mockResolvedValueOnce([
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
    ]);

    const wrapper = mountButton();
    await wrapper.get("button").trigger("click");
    await flushAsync();

    expect(apiMock.sendCommand).toHaveBeenCalledWith("dashboard/devices");
    const devices = wrapper.findAll('[data-testid="cast-dashboard-device"]');
    expect(devices).toHaveLength(2);
    expect(devices[0]!.text()).toContain("Living Room TV");
    expect(devices[0]!.text()).toContain("cast_dashboard.playing_hint");
    expect(devices[1]!.text()).toContain("Bedroom TV");
    expect(devices[1]!.text()).not.toContain("cast_dashboard.playing_hint");
  });

  it("shows a provider icon per device, skipping it for an unknown provider instance", async () => {
    apiMock.providers[CHROMECAST_PROVIDER.instance_id] = CHROMECAST_PROVIDER;
    apiMock.sendCommand.mockResolvedValueOnce([
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
    ]);

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
    apiMock.sendCommand.mockImplementation((command: string) => {
      if (command === "dashboard/devices") {
        return Promise.resolve([
          {
            device_id: "device-1",
            provider_instance: "chromecast_1",
            name: "Kitchen",
            player_id: null,
          },
        ]);
      }
      return Promise.resolve(undefined);
    });

    const wrapper = mountButton("/music-quiz");
    await wrapper.get("button").trigger("click");
    await flushAsync();

    await wrapper.get('[data-testid="cast-dashboard-device"]').trigger("click");
    await flushAsync();

    expect(apiMock.sendCommand).toHaveBeenCalledWith("dashboard/show", {
      provider_instance: "chromecast_1",
      device_id: "device-1",
      path: "/music-quiz",
    });
    expect(toastMock.success).toHaveBeenCalledWith(
      "cast_dashboard.started:Kitchen",
    );
  });

  it("leaves error toasting to the global command handler on failure", async () => {
    apiMock.providers[CHROMECAST_PROVIDER.instance_id] = CHROMECAST_PROVIDER;
    apiMock.sendCommand.mockImplementation((command: string) => {
      if (command === "dashboard/devices") {
        return Promise.resolve([
          {
            device_id: "device-1",
            provider_instance: "chromecast_1",
            name: "Kitchen",
            player_id: null,
          },
        ]);
      }
      return Promise.reject(new Error("Remote access disabled"));
    });

    const wrapper = mountButton();
    await wrapper.get("button").trigger("click");
    await flushAsync();
    await wrapper.get('[data-testid="cast-dashboard-device"]').trigger("click");
    await flushAsync();

    expect(toastMock.success).not.toHaveBeenCalled();
    expect(toastMock.error).not.toHaveBeenCalled();
  });
});

async function flushAsync() {
  await Promise.resolve();
  await Promise.resolve();
}
