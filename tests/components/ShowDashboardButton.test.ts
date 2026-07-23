import ShowDashboardButton from "@/components/ShowDashboardButton.vue";
import {
  EventType,
  type DashboardType,
  type EventMessage,
} from "@/plugins/api/interfaces";
import { Check } from "@lucide/vue";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  apiMock,
  mockWaitForApiInitialization,
  isDashboardViewerMock,
  toastMock,
} = vi.hoisted(() => ({
  apiMock: {
    sendCommand: vi.fn(),
    subscribe: vi.fn(),
  },
  mockWaitForApiInitialization: vi.fn(),
  isDashboardViewerMock: vi.fn(() => false),
  toastMock: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/plugins/api", () => ({
  default: apiMock,
}));

vi.mock("@/plugins/api/helpers", () => ({
  waitForApiInitialization: mockWaitForApiInitialization,
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

// Default dashboard so most tests get a visible button without extra setup; empty/hidden-state tests override this.
const DEFAULT_DASHBOARD = {
  dashboard_id: "device-1",
  name: "Living Room TV",
  supported_types: ["party", "now_playing"] as DashboardType[],
};

// Command responses keyed by name; unlisted commands fall back to one dashboard / no active sessions.
function mockCommands(overrides: Record<string, () => unknown> = {}) {
  apiMock.sendCommand.mockImplementation((command: string) => {
    if (command in overrides) {
      try {
        return Promise.resolve(overrides[command]!());
      } catch (error) {
        return Promise.reject(error);
      }
    }
    if (command === "dashboard/sessions") {
      return Promise.resolve([]);
    }
    if (command === "dashboard/dashboards") {
      return Promise.resolve([DEFAULT_DASHBOARD]);
    }
    return Promise.resolve(undefined);
  });
}

// Captures api.subscribe callbacks by event type so a test can fire a fake event.
function captureSubscriptions() {
  const callbacks = new Map<EventType, (evt: EventMessage) => void>();
  apiMock.subscribe.mockImplementation(
    (eventType: EventType, cb: (evt: EventMessage) => void) => {
      callbacks.set(eventType, cb);
      return vi.fn();
    },
  );
  return {
    emit: (eventType: EventType, data: unknown) =>
      callbacks.get(eventType)?.({ event: eventType, data }),
  };
}

function mountButton(
  props: { dashboard: DashboardType; playerId?: string } = {
    dashboard: "party",
  },
) {
  const passthroughStub = { template: "<div><slot /></div>" };
  return mount(ShowDashboardButton, {
    props,
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
        DashboardDeviceIcon: {
          props: ["providerDomainHint"],
          template:
            '<i data-testid="cast-dashboard-device-icon" :data-icon="providerDomainHint" />',
        },
      },
    },
  });
}

describe("ShowDashboardButton", () => {
  beforeEach(() => {
    apiMock.sendCommand.mockReset();
    apiMock.subscribe.mockReset();
    apiMock.subscribe.mockImplementation(() => vi.fn());
    mockWaitForApiInitialization.mockReset();
    mockWaitForApiInitialization.mockResolvedValue(undefined);
    mockCommands();
    isDashboardViewerMock.mockReset();
    isDashboardViewerMock.mockReturnValue(false);
    toastMock.success.mockReset();
    toastMock.error.mockReset();
  });

  it("renders nothing when no dashboards are registered", async () => {
    mockCommands({ "dashboard/dashboards": () => [] });

    const wrapper = mountButton();
    await flushAsync();

    expect(wrapper.find("button").exists()).toBe(false);
  });

  it("renders once at least one dashboard is registered", async () => {
    const wrapper = mountButton();
    await flushAsync();

    expect(wrapper.find("button").exists()).toBe(true);
  });

  it("renders nothing for a dashboard viewer session even when dashboards are registered", async () => {
    isDashboardViewerMock.mockReturnValue(true);

    const wrapper = mountButton();
    await flushAsync();

    expect(wrapper.find("button").exists()).toBe(false);
  });

  it("defers fetching until the API connection is initialized", async () => {
    // A hard page refresh can mount this before the API has finished its initial sync.
    const initialization = deferred<void>();
    mockWaitForApiInitialization.mockReturnValue(initialization.promise);

    const wrapper = mountButton();
    await flushAsync();

    expect(apiMock.sendCommand).not.toHaveBeenCalled();
    expect(wrapper.find("button").exists()).toBe(false);

    initialization.resolve();
    await flushAsync();

    expect(apiMock.sendCommand).toHaveBeenCalledWith("dashboard/dashboards", {
      dashboard: "party",
    });
    expect(wrapper.find("button").exists()).toBe(true);
  });

  it("loads and lists cast devices when opened", async () => {
    mockCommands({
      "dashboard/dashboards": () => [
        {
          dashboard_id: "device-1",
          name: "Living Room TV",
          supported_types: ["party"],
        },
        {
          dashboard_id: "device-2",
          name: "Bedroom TV",
          supported_types: ["party"],
        },
      ],
    });

    const wrapper = mountButton();
    await flushAsync();
    await wrapper.get("button").trigger("click");
    await flushAsync();

    expect(apiMock.sendCommand).toHaveBeenCalledWith("dashboard/dashboards", {
      dashboard: "party",
    });
    const devices = wrapper.findAll('[data-testid="cast-dashboard-device"]');
    expect(devices).toHaveLength(2);
    expect(devices[0]!.text()).toContain("Living Room TV");
    expect(devices[1]!.text()).toContain("Bedroom TV");
  });

  it("passes each device's provider domain hint to its icon, one per device", async () => {
    mockCommands({
      "dashboard/dashboards": () => [
        {
          dashboard_id: "device-1",
          name: "Living Room TV",
          supported_types: ["party"],
          provider_domain_hint: "chromecast",
        },
        {
          dashboard_id: "device-2",
          name: "Bedroom TV",
          supported_types: ["party"],
        },
      ],
    });

    const wrapper = mountButton();
    await flushAsync();
    await wrapper.get("button").trigger("click");
    await flushAsync();

    const icons = wrapper.findAll('[data-testid="cast-dashboard-device-icon"]');
    expect(icons).toHaveLength(2);
    expect(icons[0]!.attributes("data-icon")).toBe("chromecast");
    expect(icons[1]!.attributes("data-icon")).toBeUndefined();
  });

  it("starts the dashboard on the selected device and toasts success", async () => {
    mockCommands({
      "dashboard/dashboards": () => [
        {
          dashboard_id: "device-1",
          name: "Kitchen",
          supported_types: ["now_playing"],
        },
      ],
    });

    const wrapper = mountButton({
      dashboard: "now_playing",
      playerId: "player-1",
    });
    await flushAsync();
    await wrapper.get("button").trigger("click");
    await flushAsync();

    await wrapper.get('[data-testid="cast-dashboard-device"]').trigger("click");
    await flushAsync();

    expect(apiMock.sendCommand).not.toHaveBeenCalledWith(
      "dashboard/hide",
      expect.anything(),
    );
    expect(apiMock.sendCommand).toHaveBeenCalledWith("dashboard/show", {
      dashboard_id: "device-1",
      dashboard: "now_playing",
      player_id: "player-1",
    });
    expect(toastMock.success).toHaveBeenCalledWith("dashboard.started:Kitchen");
  });

  it("leaves error toasting to the global command handler on failure", async () => {
    mockCommands({
      "dashboard/show": () => {
        throw new Error("Remote access disabled");
      },
    });

    const wrapper = mountButton();
    await flushAsync();
    await wrapper.get("button").trigger("click");
    await flushAsync();
    await wrapper.get('[data-testid="cast-dashboard-device"]').trigger("click");
    await flushAsync();

    expect(toastMock.success).not.toHaveBeenCalled();
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it("fetches sessions on mount and shows the icon in the active color when one matches this dashboard", async () => {
    mockCommands({
      "dashboard/sessions": () => [
        {
          dashboard_id: "device-1",
          dashboard: "party",
          name: "Living Room TV",
        },
      ],
    });

    const wrapper = mountButton();
    await flushAsync();

    expect(apiMock.sendCommand).toHaveBeenCalledWith("dashboard/sessions");
    expect(wrapper.get("button").classes()).toContain("bg-primary");
  });

  it("does not color the icon when the active session is for a different dashboard", async () => {
    mockCommands({
      "dashboard/sessions": () => [
        {
          dashboard_id: "device-1",
          dashboard: "now_playing",
          name: "Living Room TV",
        },
      ],
    });

    const wrapper = mountButton();
    await flushAsync();

    expect(wrapper.get("button").classes()).not.toContain("bg-primary");
  });

  it("colors a now_playing button only when the session targets its player", async () => {
    mockCommands({
      "dashboard/sessions": () => [
        {
          dashboard_id: "device-1",
          dashboard: "now_playing",
          player_id: "player-2",
          name: "Living Room TV",
        },
      ],
    });

    const otherPlayer = mountButton({
      dashboard: "now_playing",
      playerId: "player-1",
    });
    await flushAsync();
    expect(otherPlayer.get("button").classes()).not.toContain("bg-primary");

    const matchingPlayer = mountButton({
      dashboard: "now_playing",
      playerId: "player-2",
    });
    await flushAsync();
    expect(matchingPlayer.get("button").classes()).toContain("bg-primary");
  });

  it("updates active state when a dashboard_sessions_updated event arrives", async () => {
    const subscriptions = captureSubscriptions();

    const wrapper = mountButton();
    await flushAsync();

    expect(apiMock.subscribe).toHaveBeenCalledWith(
      EventType.DASHBOARD_SESSIONS_UPDATED,
      expect.any(Function),
    );
    expect(wrapper.get("button").classes()).not.toContain("bg-primary");

    subscriptions.emit(EventType.DASHBOARD_SESSIONS_UPDATED, [
      {
        dashboard_id: "device-1",
        dashboard: "party",
        name: "Living Room TV",
      },
    ]);
    await flushAsync();

    expect(wrapper.get("button").classes()).toContain("bg-primary");
  });

  it("marks the active device with a check and offers a disconnect item", async () => {
    mockCommands({
      "dashboard/sessions": () => [
        {
          dashboard_id: "device-1",
          dashboard: "party",
          name: "Living Room TV",
        },
      ],
      "dashboard/dashboards": () => [
        {
          dashboard_id: "device-1",
          name: "Living Room TV",
          supported_types: ["party"],
        },
        {
          dashboard_id: "device-2",
          name: "Bedroom TV",
          supported_types: ["party"],
        },
      ],
    });

    const wrapper = mountButton();
    await flushAsync();
    await wrapper.get("button").trigger("click");
    await flushAsync();

    const devices = wrapper.findAll('[data-testid="cast-dashboard-device"]');
    expect(devices[0]!.findComponent(Check).exists()).toBe(true);
    expect(devices[1]!.findComponent(Check).exists()).toBe(false);

    const disconnect = wrapper.get('[data-testid="cast-dashboard-disconnect"]');
    expect(disconnect.attributes("data-variant")).toBe("destructive");
    expect(disconnect.text()).toContain("dashboard.disconnect:Living Room TV");
  });

  it("disconnect stops the active session and optimistically clears the active icon", async () => {
    mockCommands({
      "dashboard/sessions": () => [
        {
          dashboard_id: "device-1",
          dashboard: "party",
          name: "Living Room TV",
        },
      ],
    });

    const wrapper = mountButton();
    await flushAsync();
    await wrapper.get("button").trigger("click");
    await flushAsync();

    await wrapper
      .get('[data-testid="cast-dashboard-disconnect"]')
      .trigger("click");
    await flushAsync();

    expect(apiMock.sendCommand).toHaveBeenCalledWith("dashboard/hide", {
      dashboard_id: "device-1",
    });
    expect(wrapper.get("button").classes()).not.toContain("bg-primary");
  });

  it("refetches sessions when disconnect's dashboard/hide fails, rolling back the optimistic removal", async () => {
    mockCommands({
      "dashboard/sessions": () => [
        {
          dashboard_id: "device-1",
          dashboard: "party",
          name: "Living Room TV",
        },
      ],
      "dashboard/hide": () => {
        throw new Error("device offline");
      },
    });

    const wrapper = mountButton();
    await flushAsync();
    await wrapper.get("button").trigger("click");
    await flushAsync();
    apiMock.sendCommand.mockClear();

    await wrapper
      .get('[data-testid="cast-dashboard-disconnect"]')
      .trigger("click");
    await flushAsync();

    expect(apiMock.sendCommand).toHaveBeenCalledWith("dashboard/hide", {
      dashboard_id: "device-1",
    });
    expect(apiMock.sendCommand).toHaveBeenCalledWith("dashboard/sessions");
    // the resync brought the still-active session back, so the pill stays lit
    expect(wrapper.get("button").classes()).toContain("bg-primary");
  });

  it("calls the sessions and dashboards subscriptions' unsubscribe functions on unmount", async () => {
    const unsubscribeMocks: ReturnType<typeof vi.fn>[] = [];
    apiMock.subscribe.mockImplementation(() => {
      const unsubscribe = vi.fn();
      unsubscribeMocks.push(unsubscribe);
      return unsubscribe;
    });

    const wrapper = mountButton();
    await flushAsync();

    wrapper.unmount();

    expect(unsubscribeMocks).toHaveLength(2);
    for (const unsubscribe of unsubscribeMocks) {
      expect(unsubscribe).toHaveBeenCalledOnce();
    }
  });

  it("subscribes to dashboards_updated", async () => {
    mountButton();
    await flushAsync();

    expect(apiMock.subscribe).toHaveBeenCalledWith(
      EventType.DASHBOARDS_UPDATED,
      expect.any(Function),
    );
  });

  it("reloads the device list when a dashboards_updated event arrives", async () => {
    let listCall = 0;
    mockCommands({
      "dashboard/dashboards": () => {
        listCall += 1;
        return listCall === 1
          ? [DEFAULT_DASHBOARD]
          : [
              DEFAULT_DASHBOARD,
              {
                dashboard_id: "device-2",
                name: "Bedroom TV",
                supported_types: ["party"],
              },
            ];
      },
    });
    const subscriptions = captureSubscriptions();

    const wrapper = mountButton();
    await flushAsync();
    expect(
      wrapper.findAll('[data-testid="cast-dashboard-device"]'),
    ).toHaveLength(1);

    subscriptions.emit(EventType.DASHBOARDS_UPDATED, undefined);
    await flushAsync();

    expect(listCall).toBe(2);
    expect(
      wrapper.findAll('[data-testid="cast-dashboard-device"]'),
    ).toHaveLength(2);
  });

  it("selecting a different device hides the current session before showing the new one", async () => {
    mockCommands({
      "dashboard/sessions": () => [
        {
          dashboard_id: "device-1",
          dashboard: "party",
          name: "Living Room TV",
        },
      ],
      "dashboard/dashboards": () => [
        {
          dashboard_id: "device-1",
          name: "Living Room TV",
          supported_types: ["party"],
        },
        {
          dashboard_id: "device-2",
          name: "Bedroom TV",
          supported_types: ["party"],
        },
      ],
    });

    const wrapper = mountButton();
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
      dashboard_id: "device-1",
    });
    expect(apiMock.sendCommand).toHaveBeenCalledWith("dashboard/show", {
      dashboard_id: "device-2",
      dashboard: "party",
      player_id: null,
    });
  });

  it("clicking the already-active device is a no-op", async () => {
    mockCommands({
      "dashboard/sessions": () => [
        {
          dashboard_id: "device-1",
          dashboard: "party",
          name: "Living Room TV",
        },
      ],
    });

    const wrapper = mountButton();
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
  for (let index = 0; index < 8; index += 1) {
    await Promise.resolve();
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}
