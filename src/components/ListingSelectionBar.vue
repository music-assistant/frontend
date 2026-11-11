<template>
  <Teleport to="body">
    <!-- z-index 996 keeps the bar below the player bar popouts (998), their
         backdrops (997) and the mobile scrim (999), so they cover it when open.
         It floats 16px above whatever covers the bottom of the screen. -->
    <div
      class="pointer-events-none fixed inset-x-0 bottom-[calc(var(--bottom-obscured-height,0px)+16px)] z-[996] flex justify-center px-4"
    >
      <Transition
        enter-active-class="animate-in fade-in slide-in-from-bottom-4 duration-200 motion-reduce:animate-none"
        leave-active-class="animate-out fade-out slide-out-to-bottom-4 duration-150 motion-reduce:animate-none"
      >
        <div
          v-if="open"
          role="toolbar"
          :aria-label="$t('selection_actions')"
          class="pointer-events-auto flex max-w-full items-center gap-1 rounded-full border bg-popover py-1.5 pr-1.5 pl-4 text-popover-foreground shadow-lg"
        >
          <span
            class="me-2 truncate text-sm font-medium tabular-nums"
            aria-live="polite"
          >
            {{
              $t("n_selected", shown.count, { named: { count: shown.count } })
            }}
          </span>
          <Button
            v-if="!shown.allSelected"
            variant="ghost"
            size="sm"
            class="rounded-full"
            @click="emit('selectAll')"
          >
            {{ $t("select_all") }}
          </Button>
          <Button size="sm" class="rounded-full" @click="onActionsClick">
            {{ $t("actions") }}
          </Button>
          <span
            class="mx-1 h-5 w-px flex-none bg-border"
            aria-hidden="true"
          ></span>
          <Button
            variant="ghost"
            size="icon-sm"
            class="rounded-full text-muted-foreground"
            :aria-label="$t('clear_selection')"
            :title="$t('clear_selection')"
            @click="emit('clear')"
          >
            <X />
          </Button>
        </div>
      </Transition>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { X } from "@lucide/vue";
import { reactive, watchEffect } from "vue";

const props = defineProps<{
  open: boolean;
  count: number;
  allSelected: boolean;
}>();

// space between the bar and the menu opening above it
const MENU_GAP = 8;

const emit = defineEmits<{
  clear: [];
  selectAll: [];
  // the point the menu hangs from: the top right corner of the Actions button
  actions: [anchor: { x: number; y: number }];
}>();

// What the bar shows, held while it is closed so the leave animation keeps the
// last selection instead of an emptied one.
const shown = reactive({ count: props.count, allSelected: props.allSelected });
watchEffect(() => {
  if (!props.open) return;
  shown.count = props.count;
  shown.allSelected = props.allSelected;
});

/** Opens the menu above the Actions button, right-aligned with it, clear of the bar. */
function onActionsClick(evt: MouseEvent) {
  const rect = (evt.currentTarget as HTMLElement).getBoundingClientRect();
  emit("actions", { x: rect.right, y: rect.top - MENU_GAP });
}
</script>
