<template>
  <CommandGroup :heading="$t('live_sources')">
    <CommandItem
      v-for="{ source, icon, subtitle } in rows"
      :key="`live_source:${source.id}`"
      v-hold="(evt: Event) => onHold(evt, source)"
      :value="`live_source:${source.id}`"
      class="group gap-3 py-2"
      @select="emit('start', source)"
      @contextmenu.prevent="emit('menu', source, $event)"
      @click.capture="swallowClickAfterHold"
      @touchstart.passive="onTouchStart"
    >
      <!-- the look of the other results, with an icon for art -->
      <div
        class="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted"
      >
        <component
          :is="icon"
          class="size-[45%] text-muted-foreground"
          aria-hidden="true"
        />
        <span
          class="pointer-events-none absolute inset-0 m-auto hidden size-[26px] items-center justify-center rounded-full bg-primary text-white opacity-0 transition-opacity duration-150 group-data-[highlighted]:opacity-100 [@media(hover:hover)]:inline-flex"
          aria-hidden="true"
        >
          <Play
            class="play-icon-centered size-3.5 text-white"
            fill="currentColor"
            :stroke-width="0"
          />
        </span>
      </div>
      <div class="flex min-w-0 flex-col">
        <span class="truncate">{{ source.name }}</span>
        <span v-if="subtitle" class="truncate text-xs text-muted-foreground">
          {{ subtitle }}
        </span>
      </div>
      <button
        type="button"
        tabindex="-1"
        class="ml-auto inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
        :aria-label="`${$t('more_options')}: ${source.name}`"
        @mousedown.prevent
        @click.stop="emit('menu', source, $event)"
      >
        <EllipsisVertical :size="16" />
      </button>
    </CommandItem>
  </CommandGroup>
</template>

<script setup lang="ts">
import { CommandGroup, CommandItem } from "@/components/ui/command";
import { useHoldToOpenMenu } from "@/composables/useHoldToOpenMenu";
import { liveSourceSubtitle } from "@/composables/useLiveSources";
import { getLiveSourceIcon } from "@/helpers/live_sources";
import type { PlayerSource } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { EllipsisVertical, Play } from "@lucide/vue";
import { computed } from "vue";

const props = defineProps<{
  sources: PlayerSource[];
}>();

const emit = defineEmits<{
  start: [source: PlayerSource];
  menu: [source: PlayerSource, evt: Event];
}>();

const rows = computed(() =>
  props.sources.map((source) => ({
    source,
    icon: getLiveSourceIcon(source),
    subtitle: liveSourceSubtitle(source),
  })),
);

const { onHold, onTouchStart, swallowClickAfterHold } = useHoldToOpenMenu(
  (evt: Event, source: PlayerSource) => emit("menu", source, evt),
);
</script>
