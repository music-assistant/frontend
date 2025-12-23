<template>
  <div class="panelview-item-skeleton">
    <Skeleton class="skeleton-image" />
    <div class="skeleton-info">
      <Skeleton class="skeleton-title" />
      <Skeleton class="skeleton-artist" />
    </div>
    <div class="skeleton-actions">
      <Skeleton class="skeleton-icon" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { Skeleton } from "@/components/ui/skeleton";
</script>

<style scoped>
.panelview-item-skeleton {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
}

.skeleton-image {
  aspect-ratio: 1;
  width: 100%;
  border-radius: 8px;
}

.skeleton-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0 4px;
}

.skeleton-title {
  height: 16px;
  width: 85%;
}

.skeleton-artist {
  height: 14px;
  width: 60%;
}

.skeleton-actions {
  display: flex;
  gap: 8px;
  padding: 0 4px;
}

.skeleton-icon {
  width: 24px;
  height: 24px;
  border-radius: 50%;
}
</style>
