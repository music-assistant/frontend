import DeviceInputRow from "@/components/settings/providers/DeviceInputRow.vue";
import { PlayerType, type Player } from "@/plugins/api/interfaces";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { playerSource } from "../../fixtures/playerSource";

const { apiMock, routerMock } = vi.hoisted(() => ({
  apiMock: { players: {} as Record<string, Player> },
  routerMock: { push: vi.fn() },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock }));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));
vi.mock("vue-router", () => ({ useRouter: () => routerMock }));

enableAutoUnmount(afterEach);

const VARIANTS = ["list", "card"] as const;

const tv = playerSource({
  id: "tv",
  name: "TV",
  is_input: true,
  passive: false,
  owner_player_id: "den",
});

beforeEach(() => {
  vi.clearAllMocks();
  apiMock.players = {
    den: { name: "Den", type: PlayerType.PLAYER } as Player,
    turntable: { name: "Turntable", type: PlayerType.SOURCE } as Player,
  };
});

describe("DeviceInputRow", () => {
  it.each(VARIANTS)(
    "shows the name, its player and the live sources label (%s)",
    (variant) => {
      const wrapper = mount(DeviceInputRow, { props: { source: tv, variant } });

      expect(wrapper.text()).toContain("TV");
      expect(wrapper.text()).toContain("Den");
      expect(
        wrapper.get('[data-testid="provider-labels"] [data-label]').text(),
      ).toBe("settings.source_labels.live");
    },
  );

  it.each(VARIANTS)(
    "names no player for a device that is only an input (%s)",
    (variant) => {
      const source = { ...tv, name: "Phono", owner_player_id: "turntable" };
      const wrapper = mount(DeviceInputRow, { props: { source, variant } });

      expect(wrapper.text()).toContain("Phono");
      expect(wrapper.text()).not.toContain("Turntable");
    },
  );

  it.each(VARIANTS)(
    "opens the settings of its player from the row and the name (%s)",
    async (variant) => {
      const wrapper = mount(DeviceInputRow, { props: { source: tv, variant } });

      await wrapper.get('[data-testid="device-input-row"]').trigger("click");
      await wrapper.get("button").trigger("click");

      expect(routerMock.push).toHaveBeenCalledTimes(2);
      expect(routerMock.push).toHaveBeenCalledWith("/settings/editplayer/den");
    },
  );
});
