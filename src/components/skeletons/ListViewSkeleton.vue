<template>
  <div class="listview-item-skeleton">
    <Skeleton class="skeleton-thumbnail" />
    <div class="skeleton-content">
      <Skeleton class="skeleton-title" />
      <Skeleton class="skeleton-subtitle" />
    </div>
    <Skeleton class="skeleton-duration" />
  </div>
</template>

<script setup lang="ts">
import { Skeleton } from "@/components/ui/skeleton";
</script>

<style scoped>
.listview-item-skeleton {
  display: flex;
  align-items: center;
  height: 70px;
  padding: 8px 16px;
  gap: 16px;
}

.skeleton-thumbnail {
  width: 50px;
  height: 50px;
  border-radius: 4px;
  flex-shrink: 0;
}

.skeleton-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.skeleton-title {
  height: 16px;
  width: 60%;
  max-width: 300px;
}

.skeleton-subtitle {
  height: 14px;
  width: 40%;
  max-width: 200px;
}

.skeleton-duration {
  width: 45px;
  height: 14px;
  flex-shrink: 0;
}
</style>
