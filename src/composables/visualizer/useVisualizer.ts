/**
 * Shared wiring for views that host a VisualizerCanvas: the user preferences
 * that parameterize it, plus the gating for when the visualizer is actually on.
 *
 * The on/off state is per player: an explicit `visualizer_enabled.<player_id>`
 * preference wins, with the plain `visualizer_enabled` preference as the
 * default for players never toggled individually (also the settings-page
 * toggle). Toggling from a view therefore only affects the player that view is
 * showing, not every display of the user.
 */

import { computed, toValue, type MaybeRefOrGetter } from "vue";
import {
  setUserPreference,
  useUserPreferences,
} from "@/composables/userPreferences";
import { store } from "@/plugins/store";
import {
  visualizerCanRender,
  visualizerProviderAvailable,
} from "@/plugins/visualizer-relay";

/**
 * Whether the visualizer is on for this player (standalone: also usable from
 * plain functions like the player menu builder). Reads reactive store state,
 * so it stays reactive when called inside a computed.
 */
export function visualizerEnabledForPlayer(playerId?: string): boolean {
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
  const visualizerBlurPref = getPreference("visualizer_blur", 0);
  const visualizerOpacityPref = getPreference("visualizer_opacity", 100);

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
