<template>
  <section class="ed-shelf" :class="{ 'ed-shelf--dimmed': dimmed }">
    <div class="ed-shelf__head">
      <slot name="header">
        <div class="ed-shelf__titles">
          <div class="ed-shelf__title-row">
            <h2 class="ed-shelf__title">{{ title }}</h2>
            <slot name="title-append"></slot>
          </div>
          <span v-if="subtitle" class="ed-shelf__subtitle">{{ subtitle }}</span>
        </div>
      </slot>
      <div v-if="provider || $slots.actions" class="ed-shelf__aside">
        <ProviderIcon
          v-if="provider"
          class="ed-shelf__provider"
          :domain="provider"
          :size="20"
        />
        <div v-if="$slots.actions" class="ed-shelf__actions">
          <slot name="actions"></slot>
        </div>
      </div>
    </div>

    <ShelfTrack
      ref="shelfTrack"
      :gap="gap"
      :nav-center="navCenter"
      :tiles-per-view="tilesPerView"
    >
      <slot></slot>
    </ShelfTrack>
  </section>
</template>

<script lang="ts">
export interface EditorialShelfExpose {
  scrollToStart: () => void;
  alignItemStart: (selector: string) => void;
}
</script>

<script setup lang="ts">
import ProviderIcon from "@/components/ProviderIcon.vue";
import ShelfTrack, { type ShelfTrackExpose } from "@/components/ShelfTrack.vue";
import { ref } from "vue";

interface Props {
  title?: string;
  subtitle?: string | null;
  provider?: string;
  gap?: number;
  navCenter?: number;
  dimmed?: boolean;
  tilesPerView?: number;
}
withDefaults(defineProps<Props>(), {
  title: "",
  subtitle: "",
  provider: "",
  gap: 14,
  navCenter: 92,
  dimmed: false,
  tilesPerView: 0,
});

const shelfTrack = ref<ShelfTrackExpose | null>(null);

defineExpose<EditorialShelfExpose>({
  scrollToStart: () => shelfTrack.value?.scrollToStart(),
  alignItemStart: (selector: string) =>
    shelfTrack.value?.alignItemStart(selector),
});
</script>

<style scoped>
.ed-shelf {
  --ed-gutter: 28px;
  --ed-card-pad: 8px;
  position: relative;
  margin-bottom: 32px;
}
.ed-shelf__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 14px;
  padding: 0 var(--ed-gutter);
}
.ed-shelf__titles {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.ed-shelf__title-row {
  display: flex;
  align-items: baseline;
  gap: 12px;
  min-width: 0;
}
.ed-shelf__title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.4px;
  color: rgb(var(--v-theme-on-background));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ed-shelf__subtitle {
  font-size: 13px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  white-space: nowrap;
  margin-left: 1px;
}
.ed-shelf__aside {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}
.ed-shelf__provider {
  flex-shrink: 0;
}
.ed-shelf__actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}
.ed-shelf--dimmed {
  opacity: 0.4;
}

@media (max-width: 600px) {
  .ed-shelf {
    --ed-gutter: 16px;
    margin-bottom: 16px;
  }
  .ed-shelf__head {
    margin-bottom: 0;
  }
  .ed-shelf__title {
    font-size: 19px;
  }
}

@media (max-width: 500px) {
  .ed-shelf {
    --ed-card-pad: 4px;
  }
}
</style>
