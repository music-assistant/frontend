<template>
  <div class="player-card-title min-w-0">
    <template v-if="memberLayout === 'title-list' && memberNames.length > 0">
      <div
        v-for="(name, index) in memberNames"
        :key="`${index}-${name}`"
        class="flex min-w-0 items-center gap-1.5"
      >
        <span class="player-card-name truncate text-sm leading-5 font-medium">
          {{ name }}
        </span>
        <span
          v-if="index === 0"
          class="player-playback-indicator flex size-4 shrink-0 items-center justify-center"
          :class="{
            'text-primary': playing,
            hidden: !playing,
          }"
          role="img"
          :aria-label="playing ? $t('state.playing') : undefined"
          :aria-hidden="!playing"
        >
          <AudioLines aria-hidden="true" class="size-4" />
        </span>
        <Badge
          v-if="selected && index === 0"
          as="span"
          variant="default"
          class="selected-player-indicator h-5 px-2 py-0 ml-1 text-[11px] leading-none shadow-none"
        >
          {{ $t("player_tip.selected") }}
        </Badge>
        <slot v-if="index === 0"></slot>
      </div>
    </template>
    <div v-else class="flex min-w-0 items-center gap-1.5">
      <span class="player-card-name truncate text-sm font-medium">
        {{ playerName }}
      </span>
      <span
        class="player-playback-indicator flex size-4 shrink-0 items-center justify-center"
        :class="{
          'text-primary': playing,
          hidden: !playing,
        }"
        role="img"
        :aria-label="playing ? $t('state.playing') : undefined"
        :aria-hidden="!playing"
      >
        <AudioLines aria-hidden="true" class="size-4" />
      </span>
      <Badge
        v-if="selected"
        as="span"
        variant="default"
        class="selected-player-indicator h-5 px-2 py-0 ml-1 text-[11px] leading-none shadow-none"
      >
        {{ $t("player_tip.selected") }}
      </Badge>
      <slot></slot>
    </div>
    <p
      v-if="memberLayout === 'subtitle' && memberNames.length > 0"
      class="player-card-group-members text-muted-foreground mt-0.5 text-pretty text-[11px] leading-4"
    >
      {{ memberNames.join(" • ") }}
    </p>
    <div
      v-else-if="memberLayout === 'subtitle-list' && memberNames.length > 0"
      class="player-card-group-members text-muted-foreground mt-0.5"
    >
      <p
        v-for="(name, index) in visibleMemberNames"
        :key="`${index}-${name}`"
        class="player-card-group-member truncate text-xs leading-5"
      >
        {{ name }}
      </p>
      <button
        v-if="hasOverflow"
        type="button"
        class="player-card-group-toggle text-muted-foreground hover:text-foreground pointer-events-auto relative z-[2] block text-left text-xs leading-5 underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none"
        :aria-expanded="showAllMembers"
        :data-remaining-count="remainingMemberCount"
        @click.stop.prevent="showAllMembers = !showAllMembers"
      >
        {{
          showAllMembers
            ? $t("show_less")
            : $t("player_select.and_more", [remainingMemberCount])
        }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { AudioLines } from "@lucide/vue";
import { computed, ref, watch } from "vue";

import { Badge } from "@/components/ui/badge";

const props = withDefaults(
  defineProps<{
    playerName: string;
    memberNames: string[];
    memberLayout?: "subtitle" | "subtitle-list" | "title-list";
    memberLimit?: number;
    playing?: boolean;
    selected?: boolean;
  }>(),
  {
    memberLayout: "subtitle",
    memberLimit: 2,
    playing: false,
    selected: false,
  },
);

const showAllMembers = ref(false);
const hasOverflow = computed(
  () =>
    props.memberLayout === "subtitle-list" &&
    props.memberNames.length > props.memberLimit,
);
const remainingMemberCount = computed(() =>
  Math.max(0, props.memberNames.length - props.memberLimit),
);
const visibleMemberNames = computed(() =>
  showAllMembers.value
    ? props.memberNames
    : props.memberNames.slice(0, props.memberLimit),
);

watch(
  () => [props.memberLayout, ...props.memberNames],
  () => {
    showAllMembers.value = false;
  },
);
</script>
