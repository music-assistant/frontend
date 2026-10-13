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
          class="pointer-events-auto flex max-w-full items-center gap-1 rounded-full border bg-popover p-1.5 text-popover-foreground shadow-lg"
        >
          <Button
            variant="ghost"
            size="icon-sm"
            class="rounded-full"
            :aria-label="$t('clear_selection')"
            @click="emit('clear')"
          >
            <X />
          </Button>
          <span
            class="truncate px-1 text-sm font-medium tabular-nums"
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
            :aria-label="$t('tooltip.select_all')"
            @click="emit('selectAll')"
          >
            <CheckCheck />
            <span class="max-sm:hidden">{{ $t("tooltip.select_all") }}</span>
          </Button>
          <Button
            size="sm"
            class="rounded-full"
            @click="(evt: MouseEvent) => emit('actions', evt)"
          >
            {{ $t("actions") }}
          </Button>
        </div>
      </Transition>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { CheckCheck, X } from "@lucide/vue";
import { reactive, watchEffect } from "vue";

const props = defineProps<{
  open: boolean;
  count: number;
  allSelected: boolean;
}>();

const emit = defineEmits<{
  clear: [];
  selectAll: [];
  actions: [event: MouseEvent];
}>();

// What the bar shows, held while it is closed so the leave animation keeps the
// last selection instead of an emptied one.
const shown = reactive({ count: props.count, allSelected: props.allSelected });
watchEffect(() => {
  if (!props.open) return;
  shown.count = props.count;
  shown.allSelected = props.allSelected;
});
</script>
