<template>
  <Transition
    enter-active-class="transition-opacity duration-200"
    leave-active-class="transition-opacity duration-200"
    enter-from-class="opacity-0"
    leave-to-class="opacity-0"
  >
    <div
      v-if="show"
      class="fixed inset-x-0 top-0 z-20 border-b border-border bg-background/95 pt-[var(--device-inset-top)] text-foreground backdrop-blur"
    >
      <Toolbar
        :icon="ArrowLeft"
        :icon-action="() => emit('back')"
        :enforce-overflow-menu="true"
        :menu-items="menuItems"
      >
        <template #title>
          <button
            type="button"
            class="block max-w-full truncate text-base font-semibold transition-opacity duration-200"
            :class="{ 'opacity-0': !showTitle }"
            :tabindex="showTitle ? undefined : -1"
            @click="scrollToTop"
          >
            {{ title }}
          </button>
        </template>
        <template #append>
          <!-- the hero's controls carry a dark backdrop for the artwork, which
               the solid bar doesn't need -->
          <span class="contents [&>*]:bg-transparent [&>*]:hover:bg-accent">
            <slot name="append"></slot>
          </span>
        </template>
      </Toolbar>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import Toolbar from "@/components/Toolbar.vue";
import type { ContextMenuItem } from "@/helpers/context_menu_item";
import { ArrowLeft } from "@lucide/vue";

export interface Props {
  // the bar shows once the hero's own toolbar has scrolled away
  show: boolean;
  // the item name fades in once the hero's title has scrolled away too
  showTitle: boolean;
  title?: string;
  menuItems: ContextMenuItem[];
}

withDefaults(defineProps<Props>(), {
  title: undefined,
});

const emit = defineEmits<{
  (e: "back"): void;
}>();

const scrollToTop = function () {
  document
    .querySelector(".content-section")
    ?.scrollTo({ top: 0, behavior: "smooth" });
};
</script>
