<template>
  <Popover v-model:open="showTip">
    <PopoverTrigger as-child>
      <slot name="trigger"></slot>
    </PopoverTrigger>
    <PopoverContent
      side="top"
      :side-offset="8"
      :align="align"
      :class="['player-tip', `player-tip-${align}`]"
      @pointer-down-outside="dismissTip"
      @escape-key-down="dismissTip"
      @focus-outside="dismissTip"
      @click="dismissTip"
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
      <div class="tip-arrow" :style="arrowStyle"></div>
    </PopoverContent>
  </Popover>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { store } from "@/plugins/store";
import { PlaybackState } from "@/plugins/api/interfaces";

export interface Props {
  autoShow?: boolean;
  align?: "start" | "center" | "end";
  arrowOffset?: string;
  childElementId?: string;
}

const props = withDefaults(defineProps<Props>(), {
  autoShow: false,
  align: "center",
  arrowOffset: undefined,
  childElementId: undefined,
});

const emit = defineEmits<{
  click: [];
}>();

const showTip = ref(false);

let autoDismissTimeout: ReturnType<typeof setTimeout> | null = null;

const isPlaying = computed(() => {
  return (
    store.activePlayer?.playback_state === PlaybackState.PLAYING ||
    store.activePlayer?.playback_state === PlaybackState.PAUSED
  );
});

const arrowStyle = computed(() => {
  if (!props.arrowOffset) return {};
  return { left: props.arrowOffset };
});

const shouldShowTip = computed(() => {
  if (!props.autoShow) return false;
  if (store.playerTipShown) return false;
  if (!store.activePlayer) return false;
  if (store.showPlayersMenu) return false;
  return true;
});

function showPopover(openDelay: number = 1000, dismissTimeout: number = 3000) {
  if (!shouldShowTip.value) return;

  setTimeout(() => {
    showTip.value = true;

    autoDismissTimeout = setTimeout(() => {
      dismissTip();
    }, dismissTimeout);
  }, openDelay);
}

function clearAutoDismissTimeout() {
  if (autoDismissTimeout) {
    clearTimeout(autoDismissTimeout);
    autoDismissTimeout = null;
  }
}

function dismissTip() {
  showTip.value = false;
  store.playerTipShown = true;

  clearAutoDismissTimeout();

  // Prevents the child element from gaining focus after the popover closes.
  if (props.childElementId) {
    setTimeout(() => {
      document.getElementById(props.childElementId!)?.blur();
    }, 250);
  }
}

onMounted(() => {
  showPopover();
});

onUnmounted(() => {
  clearAutoDismissTimeout();
});

watch(
  () => store.playerTipShown,
  (newVal) => {
    if (newVal && showTip.value) {
      showTip.value = false;
    }
  },
);

watch(showTip, (newVal, oldVal) => {
  if (oldVal && !newVal) {
    store.playerTipShown = true;
  }
});

// Watch for players menu opening and dismiss tip immediately
watch(
  () => store.showPlayersMenu,
  (isOpen) => {
    if (isOpen && showTip.value) {
      dismissTip();
    }
  },
);
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
  width: 0;
  height: 0;
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-top: 8px solid rgb(var(--v-theme-primary));
  transform: translateX(-50%);
}

/* Arrow positioning based on alignment */
.player-tip-start .tip-arrow {
  left: 24px;
}

.player-tip-center .tip-arrow {
  left: 50%;
}

@media screen and (max-width: 313px) {
  .player-tip-end .tip-arrow {
    left: 176px;
  }
}

@media screen and (min-width: 312px) and (max-width: 411px) {
  .player-tip-end .tip-arrow {
    left: 167px;
  }
}

@media screen and (min-width: 410px) and (max-width: 511px) {
  .player-tip-end .tip-arrow {
    left: 154px;
  }
}

@media screen and (min-width: 510px) and (max-width: 621px) {
  .player-tip-end .tip-arrow {
    left: 141px;
  }
}

@media screen and (min-width: 620px) and (max-width: 770px) {
  .player-tip-end .tip-arrow {
    left: 128px;
  }
}

@media screen and (min-width: 769px) {
  .player-tip-end .tip-arrow {
    left: 188px;
  }
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
</style>
