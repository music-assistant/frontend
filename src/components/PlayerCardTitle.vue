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
        <slot v-if="index === 0"></slot>
      </div>
    </template>
    <div v-else class="flex min-w-0 items-center gap-1.5">
      <span class="player-card-name truncate text-sm font-medium">
        {{ playerName }}
      </span>
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
import { computed, ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    playerName: string;
    memberNames: string[];
    memberLayout?: "subtitle" | "subtitle-list" | "title-list";
    memberLimit?: number;
  }>(),
  {
    memberLayout: "subtitle",
    memberLimit: 2,
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
