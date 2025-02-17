import { reactive } from "vue";

export enum WebPlayerMode {
  DISABLED = "disabled",
  CONTROLS_ONLY = "controls_only",
}

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
    this.mode = mode;
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
