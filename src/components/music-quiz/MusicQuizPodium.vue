<template>
  <div class="flex items-end justify-center gap-3 sm:gap-5">
    <div
      v-for="spot in spots"
      :key="spot.row.name"
      class="flex min-w-0 flex-1 flex-col items-center gap-2"
      :class="spot.orderClass"
      :style="{ maxWidth: '9rem' }"
    >
      <Crown
        v-if="spot.crown"
        class="size-6 text-yellow-400"
        aria-hidden="true"
      />
      <MusicQuizAvatar
        :name="spot.row.name"
        :class="[spot.avatarClass, 'ring-2 ring-border']"
      />
      <span class="w-full truncate text-center font-semibold">
        {{ spot.row.name }}
      </span>
      <span class="text-primary text-lg font-bold tabular-nums">
        {{ spot.row.score }}
      </span>
      <div
        class="bg-muted flex w-full items-start justify-center rounded-t-md pt-2"
        :class="spot.barClass"
      >
        <span class="text-2xl font-black tabular-nums" :class="spot.medalClass">
          {{ spot.row.rank }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import MusicQuizAvatar from "@/components/music-quiz/MusicQuizAvatar.vue";
import type { MusicQuizLeaderboardRow } from "@/components/music-quiz/MusicQuizLeaderboard.vue";
import { Crown } from "@lucide/vue";
import { computed } from "vue";

const props = defineProps<{ rows: MusicQuizLeaderboardRow[] }>();

interface PodiumSpot {
  row: MusicQuizLeaderboardRow;
  orderClass: string;
  barClass: string;
  medalClass: string;
  avatarClass: string;
  crown: boolean;
}

const spots = computed<PodiumSpot[]>(() => {
  const [first, second, third] = props.rows;
  const layout: (PodiumSpot | null)[] = [
    second
      ? {
          row: second,
          orderClass: "order-1",
          barClass: "h-16",
          medalClass: "text-slate-400",
          avatarClass: "size-14 text-lg",
          crown: false,
        }
      : null,
    first
      ? {
          row: first,
          orderClass: "order-2",
          barClass: "h-24",
          medalClass: "text-yellow-400",
          avatarClass: "size-20 text-2xl",
          crown: true,
        }
      : null,
    third
      ? {
          row: third,
          orderClass: "order-3",
          barClass: "h-10",
          medalClass: "text-amber-700",
          avatarClass: "size-12 text-base",
          crown: false,
        }
      : null,
  ];
  return layout.filter((spot): spot is PodiumSpot => spot !== null);
});
</script>
