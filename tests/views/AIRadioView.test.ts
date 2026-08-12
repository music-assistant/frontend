import CustomizeHost from "@/components/ai-radio/CustomizeHost.vue";
import CustomizeShow from "@/components/ai-radio/CustomizeShow.vue";
import { useHosts } from "@/composables/ai-radio/useHosts";
import { useShows } from "@/composables/ai-radio/useShows";
import type { AIRadioHost, AIRadioStation } from "@/plugins/api/interfaces";
import AIRadioView from "@/views/AIRadioView.vue";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

type SendCommand = (
  command: string,
  args?: Record<string, unknown>,
) => Promise<unknown>;

const { sendCommand, getLibraryPlaylists, routeMock } = vi.hoisted(() => ({
  sendCommand: vi.fn<SendCommand>(async () => []),
  getLibraryPlaylists: vi.fn(async () => []),
  routeMock: { query: { station_id: "show-1" } as Record<string, string> },
}));

vi.mock("@/plugins/api", () => {
  const mockApi = {
    // useShows/useHosts derive ai_radio availability from the provider list;
    // useOrderedPlayers reads players directly.
    providers: {},
    players: {},
    sendCommand,
    getLibraryPlaylists,
  };
  return { default: mockApi, api: mockApi };
});

vi.mock("@/plugins/store", () => ({
  store: { activePlayerId: undefined },
}));

vi.mock("vue-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-router")>()),
  useRoute: () => routeMock,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  onBeforeRouteLeave: vi.fn(),
}));

let onConfirm: (() => Promise<void> | void) | undefined;

vi.mock("@/plugins/eventbus", () => ({
  eventbus: {
    emit: (
      _event: string,
      payload: { onConfirm: () => Promise<void> | void },
    ) => {
      onConfirm = payload.onConfirm;
    },
  },
}));

vi.mock("vue-sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

const STATION_ID = "show-1";

const station: AIRadioStation = {
  id: STATION_ID,
  name: "Existing Show",
  source_playlist_id: "",
  source_playlist_provider: "library",
  default_player_id: "",
  max_duration_minutes: 0,
  shuffle_source_tracks: true,
  host_id: "",
};

/** Wires sendCommand to a minimal in-memory ai_radio backend backed by `hosts`. */
function setupSendCommand(hosts: AIRadioHost[]) {
  sendCommand.mockImplementation(async (command, args) => {
    switch (command) {
      case "ai_radio/hosts/list":
        return hosts;
      case "ai_radio/stations/list":
        return [station];
      case "ai_radio/stations/get":
        return station;
      case "ai_radio/hosts/save": {
        const saved = (args as { host: AIRadioHost }).host;
        hosts.push(saved);
        return saved;
      }
      default:
        return [];
    }
  });
}

const getShowFetchCount = () =>
  sendCommand.mock.calls.filter(
    ([command]) => command === "ai_radio/stations/get",
  ).length;

function findButtonByText(wrapper: VueWrapper, text: string) {
  return wrapper.findAll("button").find((button) => button.text() === text);
}

async function mountView() {
  // Attached so isVisible() can resolve computed style (v-show toggling).
  const wrapper = mount(AIRadioView, { attachTo: document.body });
  await flushPromises();
  return wrapper;
}

afterEach(() => {
  vi.clearAllMocks();
  onConfirm = undefined;
  routeMock.query = { station_id: STATION_ID };
  useHosts().hosts.value = [];
  useShows().shows.value = [];
  useShows().sessions.value = [];
  useShows().playlists.value = [];
  document.body.replaceChildren();
});

describe("AIRadioView host editor / show editor interplay", () => {
  it("keeps the show draft alive while the host editor is open, and refreshes the host list on return", async () => {
    const hosts: AIRadioHost[] = [];
    setupSendCommand(hosts);
    const wrapper = await mountView();

    const showEditor = wrapper.findComponent(CustomizeShow);
    expect(showEditor.exists()).toBe(true);
    expect(showEditor.isVisible()).toBe(true);
    expect(getShowFetchCount()).toBe(1);

    await showEditor.find("#customize-show-name").setValue("My Draft Name");

    // No hosts yet, so CustomizeShow's picker shows the "create a host" hint.
    const createHostCta = findButtonByText(showEditor, "Create a host");
    expect(createHostCta).toBeTruthy();
    await createHostCta?.trigger("click");
    await flushPromises();

    // The show editor must stay mounted (just hidden), not be destroyed.
    expect(wrapper.findComponent(CustomizeShow).exists()).toBe(true);
    expect(wrapper.findComponent(CustomizeShow).isVisible()).toBe(false);

    const hostEditor = wrapper.findComponent(CustomizeHost);
    expect(hostEditor.exists()).toBe(true);
    expect(hostEditor.isVisible()).toBe(true);

    await hostEditor.find("#customize-host-name").setValue("Morning Zoo");
    await findButtonByText(hostEditor, "Save host")?.trigger("click");
    await flushPromises();

    // Host editor closes; the show editor is back and unchanged.
    expect(wrapper.findComponent(CustomizeHost).exists()).toBe(false);
    const showEditorAfter = wrapper.findComponent(CustomizeShow);
    expect(showEditorAfter.isVisible()).toBe(true);
    expect(
      (showEditorAfter.find("#customize-show-name").element as HTMLInputElement)
        .value,
    ).toBe("My Draft Name");

    // It never remounted (a remount would have refetched and clobbered the draft).
    expect(getShowFetchCount()).toBe(1);

    // The host created mid-edit is now in the picker's data source.
    expect(useHosts().hosts.value.map((host) => host.name)).toContain(
      "Morning Zoo",
    );
  });

  it("gives the host editor a clean slate on every open", async () => {
    const hosts: AIRadioHost[] = [];
    setupSendCommand(hosts);
    const wrapper = await mountView();

    async function openHostEditor() {
      const cta = findButtonByText(
        wrapper.findComponent(CustomizeShow),
        "Create a host",
      );
      await cta?.trigger("click");
      await flushPromises();
      return wrapper.findComponent(CustomizeHost);
    }

    const firstOpen = await openHostEditor();
    await firstOpen.find("#customize-host-name").setValue("Leftover Draft");

    // Back out without saving; confirm the discard prompt the way the app does.
    await firstOpen.find('[aria-label="Back"]').trigger("click");
    await onConfirm?.();
    await flushPromises();
    expect(wrapper.findComponent(CustomizeHost).exists()).toBe(false);

    const secondOpen = await openHostEditor();
    expect(
      (secondOpen.find("#customize-host-name").element as HTMLInputElement)
        .value,
    ).toBe("");
  });
});
