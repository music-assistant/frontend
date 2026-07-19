<template>
  <Card class="gap-3 py-4">
    <CardContent class="flex flex-col gap-3 px-4">
      <div class="flex items-center gap-3">
        <MusicQuizAvatar
          :name="playerName"
          class="size-11 shrink-0 text-base"
        />
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <h1 class="truncate text-lg font-bold">{{ playerName }}</h1>
            <Badge v-if="rank" variant="secondary" class="shrink-0">
              #{{ rank }}
            </Badge>
          </div>
        </div>
        <span
          class="flex shrink-0 items-baseline gap-1 text-xl font-bold tabular-nums"
        >
          {{ score }}
          <span v-if="scoreDelta" class="text-primary text-sm">
            {{ scoreDelta }}
          </span>
        </span>
      </div>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import MusicQuizAvatar from "@/components/music-quiz/MusicQuizAvatar.vue";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

defineProps<{
  playerName: string;
  rank: number | null;
  score: number;
  scoreDelta: string;
}>();
</script>
