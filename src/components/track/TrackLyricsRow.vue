<template>
  <section class="track-lyrics">
    <div
      v-hold="onHold"
      class="track-lyrics__titles"
      @touchstart.passive="onTouchStart"
      @click.capture="swallowClickAfterHold"
    >
      <h2 class="track-lyrics__title">{{ $t("lyrics") }}</h2>
    </div>

    <template v-if="lyrics !== undefined">
      <p class="track-lyrics__text" @click="showFullLyrics = true">
        {{ lyrics }}
      </p>
      <button
        type="button"
        class="track-lyrics__more"
        @click="showFullLyrics = true"
      >
        {{ $t("read_more") }}
      </button>

      <Dialog v-model:open="showFullLyrics">
        <DialogContent class="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>{{ item.name }}</DialogTitle>
          </DialogHeader>
          <p class="track-lyrics__full">{{ lyrics }}</p>
          <DialogFooter>
            <Button @click="showFullLyrics = false">{{ $t("close") }}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </template>
    <div v-else class="track-lyrics__skeleton" aria-hidden="true">
      <Skeleton
        v-for="index in 3"
        :key="index"
        class="track-lyrics__skeleton-line"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useHoldToOpenMenu } from "@/composables/useHoldToOpenMenu";
import type { Track } from "@/plugins/api/interfaces";
import { ref } from "vue";

export interface Props {
  item: Track;
  // undefined while the lyrics are still loading
  lyrics?: string;
}
defineProps<Props>();

const emit = defineEmits<{
  (e: "edit-rows"): void;
}>();

const showFullLyrics = ref(false);

const { onHold, onTouchStart, swallowClickAfterHold } = useHoldToOpenMenu(() =>
  emit("edit-rows"),
);
</script>

<style scoped>
.track-lyrics {
  padding: 26px 28px 0;
  max-width: 900px;
}
.track-lyrics__titles {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
  margin-bottom: 8px;
}
.track-lyrics__title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.4px;
  color: rgb(var(--v-theme-on-background));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.track-lyrics__text {
  margin: 0;
  font-size: 15px;
  line-height: 1.5;
  color: rgba(var(--v-theme-on-surface), 0.72);
  white-space: pre-wrap;
  cursor: pointer;
  display: -webkit-box;
  -webkit-line-clamp: 6;
  line-clamp: 6;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.track-lyrics__more {
  margin-top: 4px;
  height: 28px;
  padding: 0;
  border: 0;
  background: none;
  color: rgb(var(--v-theme-primary));
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}
.track-lyrics__full {
  margin: 0;
  max-height: 60vh;
  overflow-y: auto;
  font-size: 15px;
  line-height: 1.5;
  white-space: pre-wrap;
}
.track-lyrics__skeleton {
  display: grid;
  gap: 9px;
  padding: 3px 0;
}
.track-lyrics__skeleton-line {
  height: 14px;
  width: 60%;
}
.track-lyrics__skeleton-line:nth-child(2) {
  width: 45%;
}
.track-lyrics__skeleton-line:nth-child(3) {
  width: 52%;
}

@media (max-width: 768px) {
  .track-lyrics {
    padding: 20px 16px 0;
  }
  .track-lyrics__title {
    font-size: 19px;
  }
  .track-lyrics__text {
    font-size: 14px;
    -webkit-line-clamp: 4;
    line-clamp: 4;
  }
  .track-lyrics__more {
    margin-top: 2px;
  }
}
</style>
