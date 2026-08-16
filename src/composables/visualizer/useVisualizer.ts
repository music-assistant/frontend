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
 * A cast dashboard runs as the dashboard viewer, which has no preferences of
 * its own: it follows the preferences of the user who cast it, fetched from
 * the server and refreshed live as that user changes them.
 */

import {
  computed,
  effectScope,
  ref,
  toValue,
  watch,
  type ComputedRef,
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
import api from "@/plugins/api";
import { EventType } from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import router from "@/plugins/router";
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

// The casting user's visualizer preferences, for dashboard viewer sessions.
const viewerPreferences = ref<Record<string, unknown>>({});
let viewerPreferencesSyncStarted = false;

// The viewer identifies its session by what it is showing (route + player);
// re-fetched on the sessions-updated event, which the server also signals
// when the casting user changes their preferences.
function startViewerPreferencesSync(): void {
  if (viewerPreferencesSyncStarted) return;
  viewerPreferencesSyncStarted = true;
  effectScope(true).run(() => {
    const fetchViewerPreferences = async () => {
      const path = router.currentRoute.value.path;
      const dashboard = path.startsWith("/now-playing")
        ? "now_playing"
        : path.startsWith("/music-quiz")
          ? "music_quiz"
          : "party";
      const playerId = router.currentRoute.value.query.player;
      try {
        viewerPreferences.value =
          (await api.sendCommand<Record<string, unknown>>(
            "dashboard/viewer_preferences",
            {
              dashboard,
              player_id: typeof playerId === "string" ? playerId : undefined,
            },
          )) ?? {};
      } catch (error) {
        console.warn("[visualizer] could not fetch viewer preferences:", error);
      }
    };
    void fetchViewerPreferences();
    api.subscribe(EventType.DASHBOARD_SESSIONS_UPDATED, () => {
      void fetchViewerPreferences();
    });
  });
}

/**
 * A visualizer preference as this session should render it: the own user's
 * stored preference, or, for a dashboard viewer, the casting user's.
 */
export function visualizerPreference<T>(
  key: string,
  fallback: T,
): ComputedRef<T> {
  const { getPreference } = useUserPreferences();
  const ownPreference = getPreference<T>(key, fallback);
  return computed(() => {
    if (authManager.isDashboardViewer()) {
      startViewerPreferencesSync();
      return (viewerPreferences.value[key] as T | undefined) ?? fallback;
    }
    return ownPreference.value;
  });
}

/**
 * Whether the visualizer is on for this player (standalone: also usable from
 * plain functions like the player menu builder). Reads reactive store state,
 * so it stays reactive when called inside a computed.
 */
export function visualizerEnabledForPlayer(playerId?: string): boolean {
  if (authManager.isDashboardViewer()) {
    startViewerPreferencesSync();
    // The casting user's GLOBAL toggle describes their own screens, not the
    // display they deliberately cast to: only their per-player override and
    // the plugin's show_on_dashboards setting decide here.
    if (playerId) {
      const override =
        viewerPreferences.value[`visualizer_enabled.${playerId}`];
      if (override !== undefined) return Boolean(override);
    }
    return dashboardDefaultEnabled.value;
  }
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
  // A viewer session's preferences come from the server: start the fetch right
  // away rather than on the first (lazy) preference read.
  if (authManager.isDashboardViewer()) startViewerPreferencesSync();
  const visualizerPresetPref = visualizerPreference("visualizer_preset", "");
  const visualizerBlurPref = visualizerPreference(
    "visualizer_blur",
    VISUALIZER_BLUR_DEFAULT,
  );
  const visualizerOpacityPref = visualizerPreference(
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
