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
// of the music, and is independant from the player implementation used by the frontend.
// In case the "leading" tab is closed, another open tab will take controll.
const bc = new BroadcastChannel("web-player");

const BC_MSG = {
  IS_ACTIVE: "IS_WEBPLAYER_ACTIVE",
  IS_ACTIVE_RESPONSE: "WEBPLAYER_IS_ACTIVE",
  TAKING_CONTROL: "TAKING_CONTROL:", // Followed by the priority
  CONTROL_AVAILABLE: "CONTROL_AVAILABLE",
};

const uniqueId = crypto.randomUUID();

bc.onmessage = (event) => {
  if (
    typeof event.data === "string" &&
    event.data.startsWith(BC_MSG.TAKING_CONTROL)
  ) {
    // Another tab is taking control, silently switch back to just the notification
    // (maybe this tab was suspended by the browser and didn't respond in time?)
    if (webPlayer.tabMode === WebPlayerMode.BUILTIN) {
      // TODO: don't unregister in this case
      webPlayer.disable();
    }
    const priority = event.data.substring(BC_MSG.TAKING_CONTROL.length);
    if (highestPriority !== undefined)
      highestPriority = highestPriority > priority ? highestPriority : priority;
    else highestPriority = priority;
  }
  switch (event.data) {
    case BC_MSG.IS_ACTIVE:
      // Respond if this tab is active
      if (webPlayer.tabMode === WebPlayerMode.BUILTIN && webPlayer.player_id) {
        bc.postMessage(BC_MSG.IS_ACTIVE_RESPONSE);
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
  }
};

// Called on close
window.addEventListener("unload", function () {
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
  // (so interacted with tabs are prioritized)
  const priority = (webPlayer.interacted ? "1" : "0") + uniqueId;

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
  mode: WebPlayerMode.DISABLED,
  tabMode: WebPlayerMode.DISABLED,
  audioSource: WebPlayerMode.DISABLED,
  baseUrl: "",
  player_id: null as string | null,
  interacted: false,
  async setMode(mode: WebPlayerMode) {
    if (this.mode === mode) return;
    this.mode = mode;
    this.setTabMode(mode);
  },
  async setTabMode(mode: WebPlayerMode) {
    if (this.tabMode === mode) return;

    for (const u of unsubSubscriptions) {
      u();
    }
    unsubSubscriptions = [];

    if (this.tabMode === WebPlayerMode.BUILTIN) {
      if (this.player_id) {
        bc.postMessage(BC_MSG.CONTROL_AVAILABLE); // Notify other tabs
        await api.unregisterBuiltinPlayer(this.player_id);
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

    this.tabMode = mode;

    if (mode == WebPlayerMode.BUILTIN) {
      // Start with ususal notification, the BuiltinPlayer will switch the source when needed
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
    }
  },
  disable() {
    this.setTabMode(WebPlayerMode.CONTROLS_ONLY);
  },
  setBaseUrl(url: string) {
    if (url.endsWith("/")) url = url.slice(0, -1);
    if (url === this.baseUrl) {
      return;
    }
    const prevMode = this.tabMode;
    this.setTabMode(WebPlayerMode.DISABLED);
    this.baseUrl = url;
    this.setTabMode(prevMode);
  },
  async setInteracted() {
    if (this.interacted) return;
    this.interacted = true;
  },
});
