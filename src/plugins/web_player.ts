import { reactive } from "vue";
import api from "./api";
import {
  BuiltinPlayerEvent,
  BuiltinPlayerEventType,
  EventMessage,
  EventType,
} from "./api/interfaces";

export enum WebPlayerMode {
  DISABLED = "disabled",
  CONTROLS_ONLY = "controls_only",
  BUILTIN = "builtin",
}

// TODO: watch for interacted
// TODO: update state on power off too

let unsubSubscriptions: (() => void)[] = [];
const sendPoweredOffUpdate = function (player_id: string) {
  api.updateBuiltinPlayerState(player_id, {
    powered: false,
    playing: false,
    paused: false,
    muted: false,
    volume: 0,
    position: 0,
  });
};

export const webPlayer = reactive({
  mode: WebPlayerMode.DISABLED,
  audioSource: WebPlayerMode.DISABLED,
  baseUrl: "",
  player_id: null as string | null,
  interacted: false,
  async setMode(mode: WebPlayerMode) {
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
    this.audioSource = WebPlayerMode.DISABLED;
    this.player_id = null;

    this.mode = mode;

    if (mode == WebPlayerMode.BUILTIN) {
      // Start with ususal notification, switch to BUILTIN once powered on
      this.audioSource = WebPlayerMode.CONTROLS_ONLY;
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
    } else if (mode == WebPlayerMode.CONTROLS_ONLY) {
      this.audioSource = WebPlayerMode.CONTROLS_ONLY;
    } else {
      this.audioSource = WebPlayerMode.DISABLED;
    }

    if (this.player_id) {
      unsubSubscriptions.push(
        api.subscribe(EventType.DISCONNECTED, () => {
          // TODO: handle reconnect
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

      unsubSubscriptions.push(
        api.subscribe(
          EventType.BUILTIN_PLAYER,
          (evt: EventMessage) => {
            const data = evt.data as BuiltinPlayerEvent;
            if (data.type === BuiltinPlayerEventType.POWER_ON) {
              this.audioSource = WebPlayerMode.BUILTIN;
            } else if (data.type === BuiltinPlayerEventType.POWER_OFF) {
              this.audioSource = WebPlayerMode.CONTROLS_ONLY;
              if (this.player_id) sendPoweredOffUpdate(this.player_id);
            } else if (data.type === BuiltinPlayerEventType.TIMEOUT) {
              // TODO: timeout should probably completely shutdown the player until a full page reload
              this.audioSource = WebPlayerMode.CONTROLS_ONLY;
            }
          },
          this.player_id,
        ),
      );
    }
  },
  disable() {
    this.setMode(WebPlayerMode.CONTROLS_ONLY);
  },
  setBaseUrl(url: string) {
    if (url.endsWith("/")) url = url.slice(0, -1);
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
  },
});
