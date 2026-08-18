/**
 * Shared wiring for views that host a VisualizerCanvas: the user preferences
 * that parameterize it, plus the gating for when the visualizer is actually on.
 *
 * The on/off state is per player: an explicit `visualizer_enabled.<player_id>`
 * preference wins, with the plain `visualizer_enabled` preference as the
 * default for players never toggled individually (also the settings-page
 * toggle). Toggling from a view therefore only affects the player that view is
 * showing, not every display of the user.
 *
 * The waveform is tapped from the player's Sendspin stream, so the visualizer
 * only exists for players that have a Sendspin output at all.
 */

import { computed, toValue, type MaybeRefOrGetter } from "vue";
import {
  setUserPreference,
  useUserPreferences,
} from "@/composables/userPreferences";
import {
  VISUALIZER_BLUR_DEFAULT,
  VISUALIZER_OPACITY_DEFAULT,
} from "@/composables/visualizer/state";
import api from "@/plugins/api";
import { store } from "@/plugins/store";
import {
  visualizerCanRender,
  visualizerProviderAvailable,
} from "@/plugins/visualizer-relay";

const SENDSPIN_DOMAIN = "sendspin";

/**
 * Whether this player's audio can be visualized at all.
 *
 * The waveform comes from a tap on the player's Sendspin stream, so a player
 * without a Sendspin output can never show one, however it is playing now.
 */
export function playerSupportsVisualizer(playerId?: string): boolean {
  if (!playerId) return false;
  // may run before the players map has loaded (e.g. a display booting)
  const player = api.players?.[playerId];
  return Boolean(
    player?.output_protocols?.some(
      (protocol) => protocol.protocol_domain === SENDSPIN_DOMAIN,
    ),
  );
}

/**
 * Whether the visualizer is on for this player (standalone: also usable from
 * plain functions like the player menu builder). Reads reactive store state,
 * so it stays reactive when called inside a computed.
 */
export function visualizerEnabledForPlayer(playerId?: string): boolean {
  // A stored preference can outlive the player's ability to honour it (a
  // protocol link that disappeared, or a preference from before this gate),
  // and acting on it would only retry the relay forever.
  if (playerId && !playerSupportsVisualizer(playerId)) return false;
  const prefs = store.currentUser?.preferences;
  if (playerId) {
    const override = prefs?.[`visualizer_enabled.${playerId}`];
    if (override !== undefined) return Boolean(override);
  }
  return Boolean(prefs?.["visualizer_enabled"] ?? false);
}

export function toggleVisualizerForPlayer(playerId?: string): void {
  const key = playerId
    ? `visualizer_enabled.${playerId}`
    : "visualizer_enabled";
  void setUserPreference(key, !visualizerEnabledForPlayer(playerId));
}

export function useVisualizer(playerId?: MaybeRefOrGetter<string | undefined>) {
  const { getPreference } = useUserPreferences();
  const visualizerPresetPref = getPreference("visualizer_preset", "");
  const visualizerBlurPref = getPreference(
    "visualizer_blur",
    VISUALIZER_BLUR_DEFAULT,
  );
  const visualizerOpacityPref = getPreference(
    "visualizer_opacity",
    VISUALIZER_OPACITY_DEFAULT,
  );

  const visualizerEnabledPref = computed(() =>
    visualizerEnabledForPlayer(toValue(playerId)),
  );

  // The visualizer only exists when the milkdrop_visualizer server plugin is loaded.
  const visualizerAvailable = computed(() => visualizerProviderAvailable());

  // "On" also requires that this session can actually draw it: applying the
  // dark-palette / album-art-swap styling while the canvas stays transparent
  // (no WebGL2, or a remote session) would break the plain-background fallback.
  const visualizerActive = computed(
    () =>
      visualizerEnabledPref.value &&
      visualizerAvailable.value &&
      visualizerCanRender(),
  );

  const toggleVisualizer = () => {
    toggleVisualizerForPlayer(toValue(playerId));
  };

  return {
    visualizerEnabledPref,
    visualizerPresetPref,
    visualizerBlurPref,
    visualizerOpacityPref,
    visualizerAvailable,
    visualizerActive,
    toggleVisualizer,
  };
}
