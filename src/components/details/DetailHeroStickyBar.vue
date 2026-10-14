<template>
  <Transition
    enter-active-class="transition-opacity duration-200"
    leave-active-class="transition-opacity duration-200"
    enter-from-class="opacity-0"
    leave-to-class="opacity-0"
  >
    <div
      v-if="show"
      class="fixed inset-x-0 top-0 z-20 border-b border-border bg-background/95 pt-[var(--device-inset-top)] ps-[var(--device-inset-left)] pe-[var(--device-inset-right)] text-foreground backdrop-blur"
    >
      <div class="flex h-14 items-center gap-1 px-1">
        <Button
          variant="ghost"
          size="icon-lg"
          :aria-label="$t('back')"
          :title="$t('back')"
          @click="emit('back')"
        >
          <ArrowLeft class="size-6" />
        </Button>
        <!-- inert until it fades in, so it can't be reached while invisible -->
        <button
          type="button"
          class="min-w-0 flex-1 truncate px-2 text-left text-base font-semibold transition-opacity duration-200"
          :class="{ 'opacity-0': !showTitle }"
          :inert="!showTitle"
          @click="scrollToTop"
        >
          {{ title }}
        </button>
        <!-- the hero's controls carry a dark backdrop for the artwork, which
             the solid bar doesn't need -->
        <span class="contents [&>*]:bg-transparent [&>*]:hover:bg-accent">
          <slot name="append"></slot>
        </span>
        <Button
          v-if="menuItems.length"
          variant="ghost"
          size="icon-lg"
          :aria-label="$t('menu')"
          :title="$t('menu')"
          @click="openMenu"
        >
          <EllipsisVertical class="size-[22px]" />
        </Button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { getEventPosition } from "@/composables/useHoldToOpenMenu";
import type { ContextMenuItem } from "@/helpers/context_menu_item";
import { eventbus } from "@/plugins/eventbus";
import { ArrowLeft, EllipsisVertical } from "@lucide/vue";

export interface Props {
  // the bar shows once the hero's own toolbar has scrolled away
  show: boolean;
  // the item name fades in once the hero's title has scrolled away too
  showTitle: boolean;
  title?: string;
  menuItems: ContextMenuItem[];
}

const props = withDefaults(defineProps<Props>(), {
  title: undefined,
});

const emit = defineEmits<{
  (e: "back"): void;
}>();

const openMenu = function (event: MouseEvent) {
  const { x, y } = getEventPosition(event);
  eventbus.emit("contextmenu", { items: props.menuItems, posX: x, posY: y });
};

const scrollToTop = function () {
  document
    .querySelector(".content-section")
    ?.scrollTo({ top: 0, behavior: "smooth" });
};
</script>
