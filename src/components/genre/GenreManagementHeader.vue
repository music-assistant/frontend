<template>
  <Card>
    <CardHeader>
      <div class="flex items-center gap-4">
        <div
          class="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10"
        >
          <GenreIcon class="size-6 text-primary" />
        </div>
        <div>
          <CardTitle>{{ $t("settings.genre_management") }}</CardTitle>
          <CardDescription>
            {{ $t("settings.genre_management_description") }}
          </CardDescription>
        </div>
      </div>
    </CardHeader>
  </Card>
</template>

<script setup lang="ts">
import GenreIcon from "@/components/icons/GenreIcon.vue";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
</script>
