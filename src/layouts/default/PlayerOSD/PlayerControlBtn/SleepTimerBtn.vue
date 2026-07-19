<!--
  Sleep timer indicator. Only rendered while the active player has a running
  sleep timer; shows a live countdown and opens the sleep timer menu (presets +
  cancel) on click.
-->
<template>
  <TooltipProvider v-if="active" :delay-duration="200">
    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          :variant="pill ? 'ghost-outline' : 'outline'"
          size="xs"
          :class="['gap-1 tabular-nums', pill ? pillClass : '']"
          :aria-label="$t('sleep_timer')"
          v-bind="$attrs"
          @click.stop="openMenu"
        >
          <Moon :size="16" class="moon-rocking" />
          <span>{{ remaining }}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" class="z-[10001] max-w-[240px]">
        <p class="font-medium">{{ $t("sleep_timer") }}</p>
        <p class="mt-1 opacity-80">
          {{ $t("sleep_timer_remaining", [remaining]) }}
        </p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getSleepTimerMenuItems } from "@/helpers/sleep_timer";
import { formatDuration } from "@/helpers/utils";
import { eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { Moon } from "@lucide/vue";
import { computed, onBeforeUnmount, ref, watch } from "vue";

// forward fallthrough attrs (e.g. spacing classes) to the button, not the
// renderless TooltipProvider root.
defineOptions({ inheritAttrs: false });

withDefaults(
  defineProps<{
    // frosted-glass styling to blend with the fullscreen player cover gradient
    pill?: boolean;
  }>(),
  { pill: false },
);

// The ghost-outline variant provides the pill look, matching the other
// fullscreen header controls.
const pillClass = "relative";

// Reactive clock that ticks every second while a timer is active, driving the
// countdown and the auto-hide when it reaches zero.
const now = ref(Date.now() / 1000);

const expiresAt = computed(
  () => store.activePlayer?.sleep_timer_expires_at ?? null,
);
const active = computed(
  () => expiresAt.value != null && expiresAt.value > now.value,
);
const remaining = computed(() =>
  active.value ? formatDuration(expiresAt.value! - now.value) : "",
);

let ticker: ReturnType<typeof setInterval> | undefined;
const stopTicking = () => {
  if (ticker) {
    clearInterval(ticker);
    ticker = undefined;
  }
};
watch(
  active,
  (isActive) => {
    if (isActive && !ticker) {
      ticker = setInterval(() => (now.value = Date.now() / 1000), 1000);
    } else if (!isActive) {
      stopTicking();
    }
  },
  { immediate: true },
);
onBeforeUnmount(stopTicking);

const openMenu = function (evt: MouseEvent) {
  const player = store.activePlayer;
  if (!player) return;
  eventbus.emit("contextmenu", {
    items: getSleepTimerMenuItems(player),
    posX: evt.clientX,
    posY: evt.clientY,
  });
};
</script>

<style scoped>
.moon-rocking {
  transform-origin: 50% 50%;
  animation: moon-rock 3.2s ease-in-out infinite;
}

@keyframes moon-rock {
  0%,
  100% {
    transform: rotate(-10deg);
  }
  50% {
    transform: rotate(10deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .moon-rocking {
    animation: none;
  }
}
</style>
