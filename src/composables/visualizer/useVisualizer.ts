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

import {
  computed,
  effectScope,
  ref,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from "vue";
import {
  setUserPreference,
  useUserPreferences,
} from "@/composables/userPreferences";
import {
  VISUALIZER_BLUR_DEFAULT,
  VISUALIZER_OPACITY_DEFAULT,
} from "@/composables/visualizer/state";
import { isVisualizerSupported } from "@/composables/visualizer/useVisualizerEngine";
import { authManager } from "@/plugins/auth";
import { store } from "@/plugins/store";
import {
  reportVisualizerCapability,
  visualizerCanRender,
  visualizerProviderAvailable,
  visualizerShownOnDashboards,
} from "@/plugins/visualizer-relay";

// The plugin's show_on_dashboards setting: the enabled-default for sessions
// with no stored preference. A cast dashboard runs as the dashboard viewer,
// which has no user preferences and no way to set any, so this server-side
// setting decides for it; an explicit preference always wins.
const dashboardDefaultEnabled = ref(false);
let dashboardDefaultWatchStarted = false;

// Watched rather than fetched once: a cast receiver boots straight into a
// dashboard route, so the providers map is often still loading when the
// hosting view mounts. Module-level singleton, started on first use, in a
// detached scope so the first hosting component's unmount cannot dispose it.
function startDashboardDefaultWatch(): void {
  if (dashboardDefaultWatchStarted) return;
  dashboardDefaultWatchStarted = true;
  effectScope(true).run(() => {
    watch(
      () => visualizerProviderAvailable(),
      async (available) => {
        if (!available) return;
        // A cast/TV display that cannot render MilkDrop never mounts the
        // canvas (which reports the capable case), so its probe result would
        // stay invisible; report the negative from here instead.
        if (authManager.isDashboardViewer() && !isVisualizerSupported()) {
          void reportVisualizerCapability("none");
        }
        dashboardDefaultEnabled.value = await visualizerShownOnDashboards();
      },
      { immediate: true },
    );
  });
}

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
  return Boolean(
    prefs?.["visualizer_enabled"] ?? dashboardDefaultEnabled.value,
  );
}

export function toggleVisualizerForPlayer(playerId?: string): void {
  const key = playerId
    ? `visualizer_enabled.${playerId}`
    : "visualizer_enabled";
  void setUserPreference(key, !visualizerEnabledForPlayer(playerId));
}

export function useVisualizer(playerId?: MaybeRefOrGetter<string | undefined>) {
  startDashboardDefaultWatch();
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
