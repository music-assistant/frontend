import { reactive } from "vue";
import api from "./api";
import { store } from "./store";
import { EventType } from "./api/interfaces";

export enum WebPlayerMode {
  DISABLED = "disabled",
  CONTROLS_ONLY = "controls_only",
  BUILTIN = "builtin",
}

let unsubSubscriptions: (() => void)[] = [];

export const webPlayer = reactive({
  mode: WebPlayerMode.DISABLED,
  pending_mode: WebPlayerMode.DISABLED,
  baseUrl: "",
  player_id: null as string | null,
  interacted: false,
  async setMode(mode: WebPlayerMode) {
    if (!this.interacted) {
      this.pending_mode = mode;
      return;
    }
    if (this.mode === mode) return;

    for (const u of unsubSubscriptions) {
      u();
    }
    unsubSubscriptions = [];

    if (this.mode === WebPlayerMode.BUILTIN) {
      if (this.player_id) {
        await api.unregisterBuiltinPlayer(this.player_id);
      }
    }
    this.player_id = null;

    this.mode = mode;

    if (mode == WebPlayerMode.BUILTIN) {
      const saved_player_id = window.localStorage.getItem(
        "builtin_webplayer_id",
      );
      const player = await api.registerBuiltinPlayer(
        "Experimental Web Player",
        saved_player_id !== null ? saved_player_id : undefined,
      );
      const player_id = player.player_id;

      if (saved_player_id !== player_id) {
        window.localStorage.setItem("builtin_webplayer_id", player_id);
      }

      this.player_id = player_id;
      store.activePlayerId = player_id; // seltect the player in the UI
    }

    if (this.player_id) {
      unsubSubscriptions.push(
        api.subscribe(EventType.DISCONNECTED, () => {
          this.disable();
        }),
      );
      unsubSubscriptions.push(
        api.subscribe(
          EventType.PLAYER_REMOVED,
          () => {
            this.disable();
          },
          this.player_id,
        ),
      );
    }

    this.pending_mode = WebPlayerMode.DISABLED;
  },
  disable() {
    this.setMode(WebPlayerMode.CONTROLS_ONLY);
  },
  setBaseUrl(url: string) {
    if (url === this.baseUrl) {
      return;
    }
    const prevMode = this.mode;
    this.setMode(WebPlayerMode.DISABLED);
    this.baseUrl = url;
    this.setMode(prevMode);
  },
  async setInteracted() {
    if (this.interacted) return;
    this.interacted = true;
    if (this.pending_mode !== WebPlayerMode.DISABLED) {
      await this.setMode(this.pending_mode);
    }
  },
});
