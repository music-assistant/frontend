import { reactive } from "vue";
import api from "./api";
import { EventType } from "./api/interfaces";

export enum WebPlayerMode {
  DISABLED = "disabled",
  CONTROLS_ONLY = "controls_only",
  BUILTIN = "builtin",
}

let unsubSubscriptions: (() => void)[] = [];

// We use a channel to communicate with all other tabs of MA open.
// This allows us to limit playback to only a single tab.
// Playback can still be controlled from any tab, this just avoids double playback
// of the music, and is independent from the player implementation used by the frontend.
// In case the "leading" tab is closed, another open tab will take control.
const bc = new BroadcastChannel("web-player");

const BC_MSG = {
  IS_ACTIVE: "IS_WEBPLAYER_ACTIVE",
  IS_ACTIVE_RESPONSE: "WEBPLAYER_IS_ACTIVE",
  TAKING_CONTROL: "TAKING_CONTROL:", // Followed by the priority
  CONTROL_AVAILABLE: "CONTROL_AVAILABLE",
  CONTROL_TAKEN: "CONTROL_TAKEN",
};

// Assume we timed out if after this time we did not send any updates
// This is slightly smaller than on the server (90s) to avoid false positives with isAnotherTabActive
const TIMEOUT_DURATION_MS = 75_000;

// NOTE: using crypto.randomUUID() is not supported in insecure contexts (http)
// so we're using getRandomValues instead
const array = new Uint32Array(10);
self.crypto.getRandomValues(array);
const uniqueId = array.join("");

bc.onmessage = (event) => {
  if (
    typeof event.data === "string" &&
    event.data.startsWith(BC_MSG.TAKING_CONTROL)
  ) {
    // Another tab is taking control, silently switch back to just the notification
    // (maybe this tab was suspended by the browser and didn't respond in time?)
    if (webPlayer.tabMode === WebPlayerMode.BUILTIN) {
      // Silently fall back
      webPlayer.setTabMode(WebPlayerMode.CONTROLS_ONLY, true);
    }
    const priority = event.data.substring(BC_MSG.TAKING_CONTROL.length);
    if (highestPriority !== undefined)
      highestPriority = highestPriority > priority ? highestPriority : priority;
    else highestPriority = priority;
  }
  switch (event.data) {
    case BC_MSG.IS_ACTIVE:
      if (webPlayer.tabMode === WebPlayerMode.BUILTIN && webPlayer.player_id) {
        // Check if we timed out
        if (webPlayer.timedOutDueToThrottling()) {
          webPlayer.setTabMode(WebPlayerMode.CONTROLS_ONLY, true);
        } else {
          // Respond if this tab is active
          bc.postMessage(BC_MSG.IS_ACTIVE_RESPONSE);
        }
      }
      break;
    case BC_MSG.IS_ACTIVE_RESPONSE:
      // Resolve any pending active player checks
      activePlayerChecks.forEach((check) => {
        clearTimeout(check.timeout);
        check.resolve(true);
      });
      activePlayerChecks = [];
      break;
    case BC_MSG.CONTROL_AVAILABLE:
      // Another tab released control, take over if desired
      if (
        webPlayer.mode === WebPlayerMode.BUILTIN &&
        webPlayer.tabMode !== WebPlayerMode.BUILTIN
      ) {
        webPlayer.setTabMode(WebPlayerMode.BUILTIN);
      }
      break;
    case BC_MSG.CONTROL_TAKEN:
      // Another tab took control, in case we still think we have control (if the tab was frozen by the browser),
      // immediatly give it up
      if (webPlayer.tabMode === WebPlayerMode.BUILTIN) {
        webPlayer.setTabMode(WebPlayerMode.CONTROLS_ONLY, true);
      }
      break;
  }
};

// Called on close
window.addEventListener("unload", function () {
  // Stop listening to any events, since we will soon close.
  bc.onmessage = null;
  if (webPlayer.tabMode === WebPlayerMode.BUILTIN && webPlayer.player_id) {
    bc.postMessage(BC_MSG.CONTROL_AVAILABLE);
  }
});

// Track active player checks
interface ActiveCheck {
  resolve: (value: boolean) => void;
  timeout: number;
}
let activePlayerChecks: ActiveCheck[] = [];

async function isAnotherTabActive(): Promise<boolean> {
  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      activePlayerChecks = activePlayerChecks.filter(
        (check) => check.timeout !== timeout,
      );
      resolve(false); // No response within 500ms, assume no active player
    }, 500);

    activePlayerChecks.push({ resolve, timeout });

    // Send the message, onmessage will resolve to true in case another tab responds
    bc.postMessage(BC_MSG.IS_ACTIVE);
  });
}

let highestPriority: string | undefined;

async function canTakeControl(): Promise<boolean> {
  // Generate a unique priority string with interaction as a prefix
  // (so interacted and visible with tabs are prioritized)
  const priority =
    (webPlayer.interacted ? "1" : "0") +
    (document.hidden ? "0" : "1") +
    uniqueId;

  if (highestPriority !== undefined)
    highestPriority = highestPriority > priority ? highestPriority : priority;
  else highestPriority = priority;
  bc.postMessage(BC_MSG.TAKING_CONTROL + priority);

  return new Promise((resolve) => {
    setTimeout(() => {
      // Compare lexicographically - only one tab can win
      const wonControl = highestPriority === priority;
      highestPriority = undefined;
      resolve(wonControl);
    }, 2000);
  });
}

export const webPlayer = reactive({
  // This is target mode shared accross all tabs
  mode: WebPlayerMode.DISABLED,
  // This is the true mode of this tab.
  // In case of the BUILTIN mode, exactly one tab will have this equal to mode to avoid double playback
  tabMode: WebPlayerMode.DISABLED,
  // This dictates what component will play audio to have the notification show up on all browsers
  audioSource: WebPlayerMode.DISABLED,
  // URL of the webserver
  baseUrl: "",
  // id of the player that is provided by this frontend
  player_id: null as string | null,
  // If the user interacted with the frontend, required to avoid autoplay restrictions
  interacted: false,
  // Timestamp from when the last update was sent
  lastUpdate: 0,
  async setMode(mode: WebPlayerMode) {
    this.mode = mode;
    this.setTabMode(mode);
  },
  async setTabMode(mode: WebPlayerMode, silent: boolean = false) {
    for (const u of unsubSubscriptions) {
      u();
    }
    unsubSubscriptions = [];
    // Player id of the player that should be unregistered
    let shouldUnregister: undefined | string = undefined;

    if (this.tabMode === WebPlayerMode.BUILTIN) {
      if (this.player_id) {
        // Notify other tabs, if another tab already has control, this will change nothing
        bc.postMessage(BC_MSG.CONTROL_AVAILABLE);
        // Postpone unregiser in case we would need to immediatly re-regiser it again
        if (!silent) {
          shouldUnregister = this.player_id;
        }
      }
    }
    this.audioSource = WebPlayerMode.DISABLED;
    this.player_id = null;

    // If trying to set to a player mode, check if another tab already has it
    if (mode === WebPlayerMode.BUILTIN) {
      if (await isAnotherTabActive()) {
        // Another tab already is already responsible for the playback, fall back to CONTROLS_ONLY
        mode = WebPlayerMode.CONTROLS_ONLY;
      } else {
        // No other tab has control, but another tab tries to take control simultaneously?
        if (!(await canTakeControl())) {
          // No, another tab will take it from here
          mode = WebPlayerMode.CONTROLS_ONLY;
        }
      }
    }

    if (mode == WebPlayerMode.BUILTIN) {
      // Start with usual notification, the BuiltinPlayer will switch the source when needed
      this.audioSource = WebPlayerMode.CONTROLS_ONLY;
      const saved_player_id = window.localStorage.getItem(
        "builtin_webplayer_id",
      );
      shouldUnregister = undefined;
      const player = await api.registerBuiltinPlayer(
        "This Device",
        saved_player_id !== null ? saved_player_id : undefined,
      );
      this.lastUpdate = Date.now();
      const player_id = player.player_id;

      if (saved_player_id !== player_id) {
        window.localStorage.setItem("builtin_webplayer_id", player_id);
      }

      this.player_id = player_id;

      bc.postMessage(BC_MSG.CONTROL_TAKEN);
    } else if (mode == WebPlayerMode.CONTROLS_ONLY) {
      // This is a guaranteed to not be a first tab (since that would have the BUILTIN tabMode)
      // Therefore, this player_id should be already set
      const saved_player_id = window.localStorage.getItem(
        "builtin_webplayer_id",
      );
      this.player_id = saved_player_id;
      this.audioSource = WebPlayerMode.CONTROLS_ONLY;
    } else {
      this.audioSource = WebPlayerMode.DISABLED;
    }
    if (shouldUnregister) {
      await api.unregisterBuiltinPlayer(shouldUnregister);
    }

    this.tabMode = mode;

    if (this.player_id) {
      unsubSubscriptions.push(
        api.subscribe(EventType.DISCONNECTED, () => {
          // Reconnect is handled in App.vue
          this.setTabMode(WebPlayerMode.CONTROLS_ONLY, true);
        }),
      );
      if (this.mode === WebPlayerMode.BUILTIN) {
        unsubSubscriptions.push(
          api.subscribe(
            EventType.PLAYER_UPDATED,
            () => {
              if (
                this.player_id &&
                api.players[this.player_id] &&
                !api.players[this.player_id].available
              ) {
                // The player timed out, now that the browser gave us some time again, try to restart it
                if (this.tabMode === WebPlayerMode.BUILTIN) {
                  this.setTabMode(WebPlayerMode.CONTROLS_ONLY, true);
                }
                this.setTabMode(WebPlayerMode.BUILTIN);
              }
            },
            this.player_id,
          ),
        );
      }
      unsubSubscriptions.push(
        api.subscribe(
          EventType.PLAYER_REMOVED,
          () => {
            // Silently switch back
            this.setTabMode(WebPlayerMode.CONTROLS_ONLY, true);
          },
          this.player_id,
        ),
      );
    }
  },
  setBaseUrl(url: string) {
    if (url.endsWith("/")) url = url.slice(0, -1);
    if (url === this.baseUrl) {
      return;
    }
    const prevMode = this.tabMode;
    // First disable to avoid conflicts
    this.setTabMode(WebPlayerMode.DISABLED);
    this.baseUrl = url;
    this.setTabMode(prevMode);
  },
  async setInteracted() {
    if (this.interacted) return;
    this.interacted = true;
  },
  timedOutDueToThrottling() {
    return Date.now() - webPlayer.lastUpdate >= TIMEOUT_DURATION_MS;
  },
});
