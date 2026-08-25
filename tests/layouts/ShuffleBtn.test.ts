import ShuffleBtn from "@/layouts/default/PlayerOSD/PlayerControlBtn/ShuffleBtn.vue";
import ShuffleIcon from "@/layouts/default/PlayerOSD/PlayerControlBtn/ShuffleIcon.vue";
import api from "@/plugins/api";
import {
  MediaType,
  type Player,
  type PlayerQueue,
  type PlayerSource,
} from "@/plugins/api/interfaces";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick, reactive } from "vue";
import { playerQueue } from "../fixtures/playerQueue";
import { playerSource } from "../fixtures/playerSource";
import { queueItem } from "../fixtures/queueItem";
import { radio } from "../fixtures/radio";

vi.mock("@/plugins/api", () => {
  const api = { playerCommandShuffle: vi.fn() };
  return { api, default: api };
});

vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

const playerCommandShuffle = vi.mocked(api.playerCommandShuffle);

// Vuetify is not installed in the test app, and Icon.vue renders its icon
// inside a v-badge it never imports itself.
const stubs = {
  VIcon: { template: "<i><slot /></i>" },
  VBadge: { template: "<div><slot /></div>" },
};

function player(overrides: Partial<Player> = {}): Player {
  return {
    player_id: "player-1",
    active_source: null,
    source_list: [],
    ...overrides,
  } as unknown as Player;
}

/** A player playing Music Assistant's own queue, as the server publishes it. */
function playerOnQueue() {
  const own = playerSource({ id: "player-1", name: "Music Assistant Queue" });
  return player({ active_source: own.id, source_list: [own] });
}

/** A player taken over by a live external source, as the server publishes it. */
function playerOnSource(source: Partial<PlayerSource> = {}) {
  const live = playerSource({
    id: "spotify://audio_source/main",
    name: "Spotify Connect",
    can_shuffle: true,
    ...source,
  });
  return player({ active_source: live.id, source_list: [live] });
}

function mountButton(
  props: {
    player?: Player;
    playerQueue?: PlayerQueue;
  } = {},
) {
  return mount(ShuffleBtn, {
    props: { player: undefined, playerQueue: undefined, ...props },
    global: { stubs },
  });
}

const button = (wrapper: ReturnType<typeof mountButton>) =>
  wrapper.get(".icon-container");

const isDisabled = (wrapper: ReturnType<typeof mountButton>) =>
  button(wrapper).classes().includes("icon-container--disabled");

enableAutoUnmount(afterEach);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ShuffleBtn", () => {
  describe("on a Music Assistant queue", () => {
    // the queue is a source like any other, listed under the player's own id,
    // so the command names it and the server refuses it once something else
    // has taken the player
    it("shuffles the queue through the player", async () => {
      const wrapper = mountButton({
        player: playerOnQueue(),
        playerQueue: playerQueue(),
      });

      await button(wrapper).trigger("click");

      expect(playerCommandShuffle).toHaveBeenCalledWith(
        "player-1",
        true,
        "player-1",
      );
    });

    it("turns shuffle back off", async () => {
      const wrapper = mountButton({
        player: playerOnQueue(),
        playerQueue: playerQueue({ shuffle_enabled: true }),
      });

      await button(wrapper).trigger("click");

      expect(playerCommandShuffle).toHaveBeenCalledWith(
        "player-1",
        false,
        "player-1",
      );
    });

    it("is disabled without a queue to shuffle", () => {
      expect(isDisabled(mountButton({ player: playerOnQueue() }))).toBe(true);
    });

    it("is disabled on an inactive queue", () => {
      const wrapper = mountButton({
        player: playerOnQueue(),
        playerQueue: playerQueue({ active: false }),
      });

      expect(isDisabled(wrapper)).toBe(true);
    });

    it("is disabled on an infinite stream", () => {
      const wrapper = mountButton({
        player: playerOnQueue(),
        playerQueue: playerQueue({
          current_item: queueItem({
            media_item: radio({ media_type: MediaType.RADIO }),
          }),
        }),
      });

      expect(isDisabled(wrapper)).toBe(true);
    });

    // the command is addressed to the player, so there is nothing to send
    it("is disabled without a player", () => {
      expect(isDisabled(mountButton({ playerQueue: playerQueue() }))).toBe(
        true,
      );
    });
  });

  describe("on a live external source", () => {
    it("shuffles the source's own session through the player", async () => {
      const wrapper = mountButton({ player: playerOnSource() });

      expect(isDisabled(wrapper)).toBe(false);

      await button(wrapper).trigger("click");

      expect(playerCommandShuffle).toHaveBeenCalledWith(
        "player-1",
        true,
        "spotify://audio_source/main",
      );
    });

    it("renders the state the source reports", () => {
      const wrapper = mountButton({
        player: playerOnSource({ shuffle_enabled: true }),
      });

      expect(wrapper.findComponent(ShuffleIcon).exists()).toBe(true);
      expect(button(wrapper).attributes("title")).toBe("shuffle_disable");
    });

    // a player update lands as an in-place assign with a fresh source list, so
    // the control has to re-read what the source reports rather than keep what
    // it read when it was built
    it("follows the state the source reports as it changes", async () => {
      const live = reactive(playerOnSource({ shuffle_enabled: false }));
      const wrapper = mountButton({ player: live });

      expect(wrapper.findComponent(ShuffleIcon).exists()).toBe(false);

      live.source_list = [
        playerSource({
          id: live.active_source!,
          name: "Spotify Connect",
          can_shuffle: true,
          shuffle_enabled: true,
        }),
      ];
      await nextTick();

      expect(wrapper.findComponent(ShuffleIcon).exists()).toBe(true);
      expect(button(wrapper).attributes("title")).toBe("shuffle_disable");
    });

    it("turns shuffle back off when the source reports it on", async () => {
      const wrapper = mountButton({
        player: playerOnSource({ shuffle_enabled: true }),
      });

      await button(wrapper).trigger("click");

      expect(playerCommandShuffle).toHaveBeenCalledWith(
        "player-1",
        false,
        "spotify://audio_source/main",
      );
    });

    // the source has not reported its ordering yet, so the control still has to
    // read as actionable rather than stuck
    it("offers to turn shuffle on when the source has not reported", () => {
      const wrapper = mountButton({ player: playerOnSource() });

      expect(isDisabled(wrapper)).toBe(false);
      expect(wrapper.findComponent(ShuffleIcon).exists()).toBe(false);
      expect(button(wrapper).attributes("title")).toBe("shuffle_enable");
    });

    it("is disabled for a source that cannot shuffle", async () => {
      const wrapper = mountButton({
        player: playerOnSource({ can_shuffle: false }),
      });

      expect(isDisabled(wrapper)).toBe(true);

      await button(wrapper).trigger("click");

      expect(playerCommandShuffle).not.toHaveBeenCalled();
    });

    it("leaves an idle player alone", () => {
      const own = playerSource({ id: "player-1", can_shuffle: true });
      const wrapper = mountButton({
        player: player({ active_source: null, source_list: [own] }),
      });

      expect(isDisabled(wrapper)).toBe(true);
    });

    // the MA queue sits in the source list under the player's own id, so a
    // player on its own queue must never be taken for one a source took over —
    // reachable before that queue has arrived in the client's state, which is
    // the only moment no queue resolves for it
    it("never mistakes the player's own queue for a source", async () => {
      const own = playerSource({ id: "player-1", can_shuffle: true });
      const wrapper = mountButton({
        player: player({ active_source: "player-1", source_list: [own] }),
      });

      expect(isDisabled(wrapper)).toBe(true);

      await button(wrapper).trigger("click");

      expect(playerCommandShuffle).not.toHaveBeenCalled();
    });

    // the OSD passes store.activePlayer, a computed that yields a different
    // object when the user switches player — so the source has to be resolved
    // from the prop as it stands, not from the one captured at setup
    it("re-reads the source when the active player changes", async () => {
      const wrapper = mountButton({ player: playerOnSource() });

      expect(isDisabled(wrapper)).toBe(false);

      await wrapper.setProps({
        player: player({
          player_id: "player-2",
          active_source: "line-in",
          source_list: [playerSource({ id: "line-in", name: "Line In" })],
        }),
      });

      // line-in orders nothing, so the control on the newly selected player
      // must go dead rather than keep commanding the player left behind
      expect(isDisabled(wrapper)).toBe(true);

      await button(wrapper).trigger("click");

      expect(playerCommandShuffle).not.toHaveBeenCalled();
    });

    it("prefers the queue whenever one is playing", async () => {
      const wrapper = mountButton({
        player: playerOnSource({ shuffle_enabled: true }),
        playerQueue: playerQueue({ shuffle_enabled: false }),
      });

      await button(wrapper).trigger("click");

      // the queue's state is the one inverted, not the one the source reports
      expect(playerCommandShuffle).toHaveBeenCalledWith(
        "player-1",
        true,
        "spotify://audio_source/main",
      );
    });
  });
});
