<template>
  <!-- Informational banner that surfaces the queue's "what happens next" mode:
       an infinite radio mix, or the autoplay on/off state. Rendered inside the
       fullscreen queue list (just below the "Up next" divider). Mutually
       exclusive: radio takes precedence, otherwise the autoplay state shows.
       Collapsible: collapsed shows just the title line (the explanation is
       hidden); the expanded/collapsed choice is remembered per user. -->
  <div
    v-if="mode"
    class="queue-mode-banner"
    :class="[
      active ? 'queue-mode-banner--active' : 'queue-mode-banner--muted',
      collapsed ? 'queue-mode-banner--collapsed' : '',
    ]"
  >
    <div class="queue-mode-banner__icon" @click="toggleCollapsed">
      <RadioTower v-if="mode === 'radio'" :size="collapsed ? 14 : 20" />
      <InfinityIcon v-else :size="collapsed ? 14 : 20" />
    </div>

    <div class="queue-mode-banner__body">
      <p class="queue-mode-banner__title" @click="toggleCollapsed">
        {{ title }}
      </p>
      <p v-if="!collapsed" class="queue-mode-banner__desc">
        {{ description }}
        <button
          v-if="mode === 'autoplay' && canConfigure"
          type="button"
          class="queue-mode-banner__link"
          @click="openQueueSettings"
        >
          {{ $t("settings.configure") }}
        </button>
      </p>
    </div>

    <Switch
      v-if="mode === 'autoplay'"
      :model-value="autoplayEnabled"
      class="queue-mode-banner__switch"
      :aria-label="
        autoplayEnabled ? $t('autoplay_disable') : $t('autoplay_enable')
      "
      @update:model-value="setAutoplay"
    />

    <TooltipProvider :delay-duration="200">
      <Tooltip>
        <TooltipTrigger as-child>
          <button
            type="button"
            class="queue-mode-banner__toggle"
            :aria-label="collapsed ? $t('show_more') : $t('show_less')"
            :aria-expanded="!collapsed"
            @click="toggleCollapsed"
          >
            <ChevronDown
              :size="16"
              class="queue-mode-banner__chevron"
              :class="{ 'queue-mode-banner__chevron--open': !collapsed }"
            />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" class="z-[10001]">
          {{ collapsed ? $t("show_more") : $t("show_less") }}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  </div>
</template>

<script setup lang="ts">
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useUserPreferences } from "@/composables/userPreferences";
import { useQueueModes } from "@/layouts/default/PlayerOSD/useQueueModes";
import { authManager } from "@/plugins/auth";
import { $t } from "@/plugins/i18n";
import router from "@/plugins/router";
import { store } from "@/plugins/store";
import { ChevronDown, InfinityIcon, RadioTower } from "@lucide/vue";
import { computed } from "vue";

// Shared radio/autoplay state (kept in sync with the header pills).
const {
  queue,
  radioSources,
  radioModeActive,
  autoplayEnabled,
  autoplayApplicable,
  setAutoplay,
} = useQueueModes();

// Radio seed names, joined for the description line.
const radioSeeds = computed(() =>
  radioSources.value
    .map((source) => source.name)
    .filter(Boolean)
    .join(", "),
);

// Which mode the banner represents (radio wins; else autoplay; else hidden).
const mode = computed<"radio" | "autoplay" | null>(() => {
  if (radioModeActive.value) return "radio";
  if (autoplayApplicable.value) return "autoplay";
  return null;
});

// Active (primary-tinted) vs muted appearance.
const active = computed(() => mode.value === "radio" || autoplayEnabled.value);

const title = computed(() => {
  if (mode.value === "radio") return $t("queue_radio_enabled");
  if (mode.value === "autoplay")
    return autoplayEnabled.value
      ? $t("autoplay_on_title")
      : $t("autoplay_off_title");
  return "";
});

const description = computed(() => {
  if (mode.value === "radio")
    return radioSeeds.value
      ? `${$t("queue_radio_based_on")} ${radioSeeds.value}`
      : $t("radio_explanation");
  if (mode.value === "autoplay")
    return autoplayEnabled.value
      ? $t("autoplay_on_desc")
      : $t("autoplay_off_desc");
  return "";
});

// The full queue settings page is an admin-only shortcut (matches the menu).
const canConfigure = computed(() => authManager.isAdmin());

// Collapsed state is remembered per user (server-side preference, so it syncs
// across devices). Default expanded so new users get the full explanation; once
// they collapse it, only the title line shows from then on.
const { getPreference, setPreference } = useUserPreferences();
const collapsed = getPreference<boolean>("queueModeBannerCollapsed", false);
const toggleCollapsed = () => {
  setPreference("queueModeBannerCollapsed", !collapsed.value);
};

const openQueueSettings = () => {
  const q = queue.value;
  if (!q) return;
  store.showFullscreenPlayer = false;
  router.push(`/settings/editqueue/${q.queue_id}`);
};
</script>

<style scoped>
.queue-mode-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  /* No horizontal margin so the card spans the full row width, matching the
     now-playing item above. 8px horizontal padding aligns the icon with the
     track thumbnails; tight vertical padding keeps the card compact. */
  margin: 1px 0 6px;
  padding: 5px 8px;
  border-radius: 8px;
  border: 1px solid
    color-mix(in srgb, var(--text-color, currentColor) 12%, transparent);
  background: color-mix(
    in srgb,
    var(--text-color, currentColor) 4%,
    transparent
  );
}

/* Active (radio / autoplay-on): subtle primary wash so it reads as "on". */
.queue-mode-banner--active {
  border-color: color-mix(in srgb, var(--primary) 35%, transparent);
  background: color-mix(in srgb, var(--primary) 9%, transparent);
}

/* Collapsed: a tight single line — shrink the padding, gap, icon and toggle so
   the row is as compact as possible while still showing the title. */
.queue-mode-banner--collapsed {
  gap: 8px;
  padding: 2px 8px;
}

.queue-mode-banner--collapsed .queue-mode-banner__icon {
  width: 22px;
  height: 22px;
  border-radius: 6px;
}

.queue-mode-banner__icon {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  cursor: pointer;
  color: color-mix(in srgb, var(--text-color, currentColor) 65%, transparent);
  background: color-mix(
    in srgb,
    var(--text-color, currentColor) 10%,
    transparent
  );
}

.queue-mode-banner--active .queue-mode-banner__icon {
  color: var(--primary-foreground, #fff);
  background: var(--primary);
}

.queue-mode-banner__body {
  flex: 1 1 auto;
  min-width: 0;
}

.queue-mode-banner__title {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  color: var(--text-color, currentColor);
}

.queue-mode-banner__desc {
  margin: 1px 0 0;
  font-size: 0.78rem;
  line-height: 1.3;
  color: var(--text-color, currentColor);
  opacity: 0.72;
}

.queue-mode-banner__link {
  appearance: none;
  border: none;
  background: none;
  padding: 0;
  font: inherit;
  color: var(--primary);
  font-weight: 600;
  cursor: pointer;
}

.queue-mode-banner__link:hover {
  text-decoration: underline;
}

.queue-mode-banner__switch {
  flex: 0 0 auto;
  align-self: center;
}

.queue-mode-banner__toggle {
  flex: 0 0 auto;
  align-self: center;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  border: none;
  background: none;
  cursor: pointer;
  color: color-mix(in srgb, var(--text-color, currentColor) 55%, transparent);
  transition: color 0.12s ease;
}

.queue-mode-banner__toggle:hover {
  color: var(--text-color, currentColor);
}

.queue-mode-banner__chevron {
  transition: transform 0.18s ease;
}

.queue-mode-banner__chevron--open {
  transform: rotate(180deg);
}
</style>
