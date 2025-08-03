import api from "@/plugins/api";
import { store } from "@/plugins/store";

// Shared skip control logic with throttling for smooth multiple clicks
class SkipControlManager {
  private lastSeekPos: number | undefined = undefined;
  private lastSeekPosTimeoutHandle: any = undefined;
  private readonly TIMEOUT_MS = 2000;

  private lastSeekPosTimeout() {
    clearTimeout(this.lastSeekPosTimeoutHandle);
    this.lastSeekPosTimeoutHandle = setTimeout(() => {
      this.lastSeekPos = undefined;
      this.lastSeekPosTimeoutHandle = undefined;
    }, this.TIMEOUT_MS);
  }

  public skip(queueId: string, skipSeconds: number) {
    const currentTime =
      this.lastSeekPos || store.activePlayerQueue?.elapsed_time || 0;
    const newTime = Math.max(0, currentTime + skipSeconds);

    this.lastSeekPos = newTime;
    this.lastSeekPosTimeout();

    // Send the seek command immediately for the accumulated position
    api.playerCommandSeek(
      store.activePlayer?.player_id || "",
      Math.round(newTime),
    );
  }
}

export const skipControlManager = new SkipControlManager();