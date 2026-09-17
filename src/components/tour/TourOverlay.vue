<template>
  <Teleport to="body">
    <Transition name="tour-fade">
      <!-- the cut-out around the stop; the shadow around it is what dims the
           rest of the screen -->
      <div
        v-if="frame"
        class="tour-spotlight"
        :style="{
          top: `${frame.top}px`,
          left: `${frame.left}px`,
          width: `${frame.width}px`,
          height: `${frame.height}px`,
        }"
        aria-hidden="true"
        data-testid="tour-spotlight"
      ></div>
    </Transition>
  </Teleport>

  <Popover :open="shown" modal @update:open="onOpenChange">
    <!-- anchored to the stop itself rather than to a trigger, and repositioned
         every frame so the card keeps up with a sidebar sliding open -->
    <PopoverContent
      v-if="current"
      :reference="target ?? undefined"
      :side="side"
      align="center"
      :side-offset="CARD_GAP"
      :collision-padding="CARD_COLLISION_PADDING"
      update-position-strategy="always"
      :aria-labelledby="titleId"
      :aria-describedby="descriptionId"
      class="z-[10002] flex w-80 max-w-[calc(100vw-1.5rem)] flex-col gap-3"
      data-testid="tour-card"
      @interact-outside.prevent
      @open-auto-focus="focusNext"
      @keydown="onKeydown"
    >
      <div class="flex items-center justify-between gap-2">
        <span class="text-muted-foreground text-xs" data-testid="tour-counter">
          {{
            $t("tour.step_counter", {
              current: index + 1,
              total: stops.length,
            })
          }}
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          class="-mr-1.5"
          :aria-label="$t('tour.end')"
          :title="$t('tour.end')"
          data-testid="tour-end"
          @click="end"
        >
          <X class="size-4" />
        </Button>
      </div>

      <!-- read out as the stops change, since focus stays on the button that
           moves between them -->
      <div class="flex flex-col gap-1" aria-live="polite">
        <h2 :id="titleId" class="font-semibold" data-testid="tour-title">
          {{ $t(`tour.stops.${current}.title`) }}
        </h2>
        <p :id="descriptionId" class="text-muted-foreground text-sm">
          {{ $t(`tour.stops.${current}.description`) }}
        </p>
      </div>

      <div class="flex items-center justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          :disabled="index === 0"
          data-testid="tour-back"
          @click="back"
        >
          {{ $t("back") }}
        </Button>
        <Button
          ref="nextButton"
          size="sm"
          data-testid="tour-next"
          @click="next"
        >
          {{ isLast ? $t("done") : $t("tour.next") }}
        </Button>
      </div>
    </PopoverContent>
  </Popover>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { useSidebar } from "@/components/ui/sidebar";
import { useCommandCenter } from "@/composables/useCommandCenter";
import { useTour } from "@/composables/useTour";
import {
  availableTourStops,
  findTourTarget,
  sameFrame,
  spotlightFrame,
  tourCardSide,
  type TourFrame,
  type TourStopId,
} from "@/helpers/tour";
import { store } from "@/plugins/store";
import { X } from "@lucide/vue";
import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  shallowRef,
  useId,
  watch,
  type ComponentPublicInstance,
} from "vue";

// room the spotlight keeps around the stop
const SPOTLIGHT_MARGIN = 6;
// the gap between the spotlight's edge and the card
const CARD_GAP = SPOTLIGHT_MARGIN + 8;
// room the card keeps from the edges of the screen
const CARD_COLLISION_PADDING = 12;

const { active, end } = useTour();
const { isMobile, state, setOpen, setOpenMobile } = useSidebar();
const { close: closeCommandCenter } = useCommandCenter();

const titleId = useId();
const descriptionId = useId();

// the stops this run walks, settled once as it starts from what is on screen
const stops = ref<TourStopId[]>([]);
const index = ref(0);
const shown = ref(false);
const target = shallowRef<HTMLElement | null>(null);
const frame = ref<TourFrame | null>(null);
const nextButton = ref<ComponentPublicInstance | null>(null);

// the sidebar was collapsed when the tour opened it, so it goes back that way
let collapseAfter = false;
// the animation frame the spotlight is measured on, while a stop is shown
let frameRequest = 0;

const current = computed(() => stops.value[index.value]);
const isLast = computed(() => index.value === stops.value.length - 1);
const side = computed(() =>
  target.value ? tourCardSide(target.value) : "top",
);

const next = function (): void {
  if (isLast.value) {
    end();
    return;
  }
  index.value += 1;
  show();
};

const back = function (): void {
  if (index.value === 0) return;
  index.value -= 1;
  show();
  // the button that went back is disabled on the first stop, so focus moves
  // off it
  if (index.value === 0) focusNext();
};

const onKeydown = function (event: KeyboardEvent): void {
  if (event.key === "ArrowRight") next();
  else if (event.key === "ArrowLeft") back();
};

// reka closes the card on Escape, which ends the tour rather than leaving the
// screen dimmed behind a card that is gone
const onOpenChange = function (open: boolean): void {
  if (!open) end();
};

// the card opens on its Next button instead of on the close button that comes
// first in it
const focusNext = function (event?: Event): void {
  event?.preventDefault();
  nextButton.value?.$el?.focus();
};

/**
 * Set the screen up for the stops and walk in: the menu in its everyday shape
 * and nothing open over the bar, with a collapsed sidebar opened up so its
 * sections can be pointed at. A run with nothing to point at ends at once.
 */
const begin = async function (): Promise<void> {
  store.navMenuEditMode = false;
  store.showPlayersMenu = false;
  store.showFullscreenPlayer = false;
  closeCommandCenter();
  if (isMobile.value) {
    setOpenMobile(false);
  } else if (state.value === "collapsed") {
    setOpen(true);
    collapseAfter = true;
  }
  // the stops are read off the page once it reflects the above
  await nextTick();
  stops.value = availableTourStops();
  index.value = 0;
  if (stops.value.length === 0) {
    end();
    return;
  }
  show();
};

const finishRun = function (): void {
  cancelAnimationFrame(frameRequest);
  frameRequest = 0;
  shown.value = false;
  frame.value = null;
  if (collapseAfter) setOpen(false);
  collapseAfter = false;
};

const show = function (): void {
  const element = findTourTarget(current.value);
  // the layout can change under a running tour, a window shrunk to a phone's
  // width say; a stop that is no longer there ends it
  if (!element) {
    end();
    return;
  }
  element.scrollIntoView({ block: "nearest", inline: "nearest" });
  target.value = element;
  shown.value = true;
  // measured right away, so the spotlight sets off for the stop with the card
  // rather than a frame behind it
  measure();
  if (!frameRequest) track();
};

// the frame is only written when it moves, so a still screen renders nothing
const measure = function (): void {
  const element = target.value;
  if (!element) return;
  const measured = spotlightFrame(
    element.getBoundingClientRect(),
    SPOTLIGHT_MARGIN,
  );
  if (!frame.value || !sameFrame(frame.value, measured)) frame.value = measured;
};

// The spotlight follows the stop frame by frame while a stop is shown: that
// keeps it on a sidebar sliding open, a sheet sliding shut or a bar moving with
// the window, without listening for each of those.
const track = function (): void {
  measure();
  frameRequest = requestAnimationFrame(track);
};

watch(
  active,
  (running) => {
    if (running) void begin();
    else finishRun();
  },
  { immediate: true },
);

// the layout is going away, and the tour has nothing to point at without it
onBeforeUnmount(() => {
  finishRun();
  end();
});
</script>

<style scoped>
.tour-spotlight {
  position: fixed;
  z-index: 10001;
  border-radius: 10px;
  /* the shadow is the scrim: it reaches past every edge of the screen, so the
     stop is the one thing left undimmed */
  box-shadow: 0 0 0 200vmax rgb(0 0 0 / 0.6);
  pointer-events: none;
  transition:
    top 250ms ease,
    left 250ms ease,
    width 250ms ease,
    height 250ms ease;
}

.tour-fade-enter-active,
.tour-fade-leave-active {
  transition: opacity 200ms ease;
}

.tour-fade-enter-from,
.tour-fade-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .tour-spotlight,
  .tour-fade-enter-active,
  .tour-fade-leave-active {
    transition: none;
  }
}
</style>
