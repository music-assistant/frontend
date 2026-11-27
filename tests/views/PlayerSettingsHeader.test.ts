import {
  IdentifierType,
  PlayerType,
  type Player,
  type PlayerConfig,
} from "@/plugins/api/interfaces";
import { Button } from "@/components/ui/button";
import PlayerSettingsHeader from "@/views/settings/PlayerSettingsHeader.vue";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { apiMock, copyToClipboard, toastMock } = vi.hoisted(() => ({
  apiMock: {
    getProviderManifest: vi.fn(),
    serverInfo: { value: undefined as { server_version: string } | undefined },
  },
  copyToClipboard: vi.fn<(text: string) => Promise<boolean>>(),
  toastMock: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string, args?: unknown[]) =>
    args ? `${key}(${args.join(",")})` : key,
}));

vi.mock("@/helpers/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/helpers/utils")>()),
  copyToClipboard,
}));

vi.mock("vue-sonner", () => ({ toast: toastMock }));

const PLAYER_ID = "cc5e1f0a9b2d4c7e";
const IP_ADDRESS = "192.0.2.10";
const MAC_ADDRESS = "00:00:5E:00:53:01";

describe("PlayerSettingsHeader", () => {
  enableAutoUnmount(afterEach);

  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.serverInfo.value = undefined;
    copyToClipboard.mockResolvedValue(true);
  });

  it("names the player", () => {
    const wrapper = mountHeader();

    expect(wrapper.get("h2").text()).toBe("Kitchen");
  });

  it("sums up the device and the kind of player on one line", () => {
    const wrapper = mountHeader();

    expect(summary(wrapper)).toBe("Acme / Cast Speaker · player_type.player");
  });

  it("leaves out the parts of the device that are unknown", () => {
    const wrapper = mountHeader({
      player: player({ manufacturer: "", model: "Cast Speaker" }),
    });
    expect(summary(wrapper)).toBe("Cast Speaker · player_type.player");

    const bare = mountHeader({
      player: player({ manufacturer: "", model: "" }),
    });
    expect(summary(bare)).toBe("player_type.player");
  });

  it("shows no summary while the server does not know the player", () => {
    const wrapper = mountHeader({ player: undefined });

    expect(wrapper.find('[data-testid="player-summary"]').exists()).toBe(false);
  });

  it("keeps the technical details out of sight until asked for", async () => {
    const wrapper = mountHeader();
    expect(wrapper.find('[data-testid="player-details"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain(PLAYER_ID);
    expect(wrapper.text()).not.toContain(IP_ADDRESS);
    expect(wrapper.text()).not.toContain(MAC_ADDRESS);

    await openDetails(wrapper);

    expect(detailRows(wrapper)).toEqual([
      ["settings.player_details.id", PLAYER_ID],
      ["settings.player_details.ip_address", IP_ADDRESS],
      ["settings.player_details.mac_address", MAC_ADDRESS],
    ]);
  });

  it("lists only the details the player has", async () => {
    const wrapper = mountHeader({ player: player({ identifiers: {} }) });

    await openDetails(wrapper);

    expect(detailRows(wrapper)).toEqual([
      ["settings.player_details.id", PLAYER_ID],
    ]);
  });

  it.each([
    ["settings.player_details.id", PLAYER_ID],
    ["settings.player_details.ip_address", IP_ADDRESS],
    ["settings.player_details.mac_address", MAC_ADDRESS],
  ])("copies the %s and confirms it", async (label, value) => {
    const wrapper = mountHeader();
    await openDetails(wrapper);

    await wrapper
      .get(`button[aria-label="settings.player_details.copy(${label})"]`)
      .trigger("click");
    await flushPromises();

    expect(copyToClipboard).toHaveBeenCalledWith(value);
    expect(toastMock.success).toHaveBeenCalledWith(
      `settings.player_details.copied(${label})`,
    );
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it("says so when a copy fails", async () => {
    copyToClipboard.mockResolvedValue(false);
    const wrapper = mountHeader();
    await openDetails(wrapper);

    await wrapper
      .get(
        'button[aria-label="settings.player_details.copy(settings.player_details.id)"]',
      )
      .trigger("click");
    await flushPromises();

    expect(toastMock.error).toHaveBeenCalledWith(
      "settings.player_details.copy_failed(settings.player_details.id)",
    );
    expect(toastMock.success).not.toHaveBeenCalled();
  });

  it("offers reconfiguring as a secondary action", () => {
    const wrapper = mountHeader({ setupLabel: "reconfigure_player" });
    const setup = wrapper.get('[data-testid="player-setup"]');

    expect(setup.text()).toContain("reconfigure_player");
    expect(setupVariant(wrapper)).toBe("outline");
  });

  it("makes the setup the main action while the player needs it", () => {
    const wrapper = mountHeader({ setupLabel: "configure_player" });
    const setup = wrapper.get('[data-testid="player-setup"]');

    expect(setup.text()).toContain("configure_player");
    expect(setupVariant(wrapper)).toBe("default");
  });

  it("asks for the setup", async () => {
    const wrapper = mountHeader();

    await wrapper.get('[data-testid="player-setup"]').trigger("click");

    expect(wrapper.emitted("setup")).toHaveLength(1);
  });

  it("keeps the documentation link without any setup action", () => {
    const wrapper = mountHeader({ setupLabel: undefined });

    expect(wrapper.find('[data-testid="player-setup"]').exists()).toBe(false);
    expect(
      wrapper.get('[data-testid="player-documentation"]').attributes(),
    ).toMatchObject({
      href: "https://music-assistant.io/settings/individual-player/",
      rel: "noopener noreferrer",
      target: "_blank",
    });
  });

  it("links the beta documentation from a beta server", () => {
    apiMock.serverInfo.value = { server_version: "2.9.0b1" };

    const wrapper = mountHeader();

    expect(
      wrapper.get('[data-testid="player-documentation"]').attributes("href"),
    ).toBe("https://beta.music-assistant.io/settings/individual-player/");
  });

  it("asks to rename the player", async () => {
    const wrapper = mountHeader();

    await wrapper.get('[title="settings.player_name"]').trigger("click");

    expect(wrapper.emitted("rename")).toHaveLength(1);
  });

  it("hands the click on the kebab to the page that builds the menu", async () => {
    const wrapper = mountHeader();

    await wrapper
      .get('[data-testid="player-menu"]')
      .trigger("click", { clientX: 10, clientY: 20 });

    const [evt] = wrapper.emitted<[MouseEvent]>("openMenu")![0];
    expect(evt).toMatchObject({ clientX: 10, clientY: 20 });
  });
});

function playerConfig(): PlayerConfig {
  return {
    player_id: PLAYER_ID,
    provider: "chromecast--1",
    enabled: true,
    name: "Kitchen",
    default_name: "Cast Speaker",
    player_type: PlayerType.PLAYER,
    values: {},
  };
}

function player({
  manufacturer = "Acme",
  model = "Cast Speaker",
  identifiers = {
    [IdentifierType.IP_ADDRESS]: IP_ADDRESS,
    [IdentifierType.MAC_ADDRESS]: MAC_ADDRESS,
  },
}: {
  manufacturer?: string;
  model?: string;
  identifiers?: Partial<Record<IdentifierType, string>>;
} = {}): Player {
  return {
    player_id: PLAYER_ID,
    type: PlayerType.PLAYER,
    icon: "mdi-speaker",
    output_protocols: [],
    device_info: { manufacturer, model, identifiers },
  } as unknown as Player;
}

function mountHeader(
  props: {
    player?: Player;
    setupLabel?: "configure_player" | "reconfigure_player";
  } = {},
) {
  // a prop given as undefined stays undefined, one left out gets its default
  return mount(PlayerSettingsHeader, {
    props: {
      config: playerConfig(),
      player: "player" in props ? props.player : player(),
      setupLabel:
        "setupLabel" in props ? props.setupLabel : "reconfigure_player",
    },
    global: {
      mocks: {
        $t: (key: string, args?: unknown[]) =>
          args ? `${key}(${args.join(",")})` : key,
      },
    },
  });
}

function summary(wrapper: ReturnType<typeof mountHeader>): string {
  return wrapper.get('[data-testid="player-summary"]').text();
}

function setupVariant(wrapper: ReturnType<typeof mountHeader>) {
  return wrapper
    .findAllComponents(Button)
    .find((button) => button.attributes("data-testid") === "player-setup")
    ?.props("variant");
}

async function openDetails(wrapper: ReturnType<typeof mountHeader>) {
  await wrapper.get('[data-testid="player-details-toggle"]').trigger("click");
  await flushPromises();
}

/**
 * The label and value of each row of the details, in order.
 */
function detailRows(wrapper: ReturnType<typeof mountHeader>) {
  return wrapper
    .get('[data-testid="player-details"]')
    .findAll("dt")
    .map((label) => [
      label.text(),
      label.element.nextElementSibling?.textContent?.trim(),
    ]);
}
