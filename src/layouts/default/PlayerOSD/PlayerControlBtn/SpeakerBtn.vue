<template>
  <!-- active player -->
  <Popover v-model:open="showTip">
    <PopoverTrigger as-child>
      <Button variant="icon" :ripple="false" icon @click="openPlayersMenu">
        <v-icon
          :color="color ? color : ''"
          :size="24"
          :icon="
            store.activePlayer?.group_members.length
              ? 'mdi-speaker-multiple'
              : 'mdi-speaker'
          "
        />
      </Button>
    </PopoverTrigger>
    <PopoverContent
      side="top"
      :side-offset="8"
      class="player-tip"
      @pointer-down-outside="dismissTip"
      @escape-key-down="dismissTip"
      @focus-outside="dismissTip"
    >
      <div class="tip-content">
        <div class="tip-label">
          {{
            isPlaying
              ? $t("player_tip.currently_playing")
              : $t("player_tip.selected_player")
          }}
        </div>
        <div class="tip-player-name">{{ store.activePlayer?.name }}</div>
        <div class="tip-hint">{{ $t("player_tip.click_to_change") }}</div>
      </div>
      <div class="tip-arrow"></div>
    </PopoverContent>
  </Popover>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import Button from "@/components/Button.vue";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { store } from "@/plugins/store";
import { webPlayer } from "@/plugins/web_player";
import { PlaybackState } from "@/plugins/api/interfaces";

export interface Props {
  color?: string;
}
defineProps<Props>();

const showTip = ref(false);
let tipWasShown = false;
let autoDismissTimeout: ReturnType<typeof setTimeout> | null = null;

const isPlaying = computed(() => {
  return (
    store.activePlayer?.playback_state === PlaybackState.PLAYING ||
    store.activePlayer?.playback_state === PlaybackState.PAUSED
  );
});

const shouldShowTip = computed(() => {
  if (tipWasShown || store.playerTipShown) return false;
  if (!store.activePlayer) return false;
  if (store.activePlayerId === webPlayer.player_id) return false;
  return true;
});

function dismissTip() {
  showTip.value = false;
  tipWasShown = true;
  store.playerTipShown = true;
  if (autoDismissTimeout) {
    clearTimeout(autoDismissTimeout);
    autoDismissTimeout = null;
  }
}

function openPlayersMenu() {
  dismissTip();
  store.showPlayersMenu = true;
}

function handleGlobalClick() {
  if (showTip.value) {
    dismissTip();
  }
}

onMounted(() => {
  if (store.playerTipShown) {
    tipWasShown = true;
    return;
  }

  setTimeout(() => {
    if (shouldShowTip.value) {
      showTip.value = true;
      document.addEventListener("click", handleGlobalClick, { capture: true });
      // Auto-dismiss after 2.5 seconds
      autoDismissTimeout = setTimeout(() => {
        dismissTip();
      }, 2500);
    }
  }, 1000);
});

onUnmounted(() => {
  document.removeEventListener("click", handleGlobalClick, { capture: true });
  if (autoDismissTimeout) {
    clearTimeout(autoDismissTimeout);
    autoDismissTimeout = null;
  }
});

watch(
  () => store.playerTipShown,
  (newVal) => {
    if (newVal && showTip.value) {
      showTip.value = false;
      tipWasShown = true;
    }
  },
);

watch(showTip, (newVal, oldVal) => {
  if (oldVal && !newVal) {
    tipWasShown = true;
    store.playerTipShown = true;
  }
});
</script>

<style>
/* Player tip popover - global styles needed because PopoverContent renders in a portal */
.player-tip {
  width: auto !important;
  max-width: 250px;
  padding: 12px 16px !important;
  text-align: center;
  background: rgb(var(--v-theme-surface)) !important;
  border: 1px solid rgb(var(--v-theme-primary)) !important;
  z-index: 99999 !important;
}

.player-tip .tip-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.player-tip .tip-label {
  font-size: 0.75rem;
  opacity: 0.8;
}

.player-tip .tip-player-name {
  font-weight: 600;
  font-size: 0.95rem;
  color: rgb(var(--v-theme-primary));
}

.player-tip .tip-hint {
  font-size: 0.7rem;
  opacity: 0.7;
  margin-top: 4px;
}

.player-tip .tip-arrow {
  position: absolute;
  bottom: -7px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-top: 8px solid rgb(var(--v-theme-primary));
}

.player-tip .tip-arrow::after {
  content: "";
  position: absolute;
  top: -9px;
  left: -6px;
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 6px solid rgb(var(--v-theme-surface));
}

.no_transform {
  text-transform: none;
}
</style>
