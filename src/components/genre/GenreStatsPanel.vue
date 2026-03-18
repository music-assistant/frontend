<template>
  <div class="space-y-4">
    <Item variant="outline" size="sm" class="justify-between">
      <ItemContent>
        <ItemTitle>{{ $t("settings.total_genres") }}</ItemTitle>
      </ItemContent>
      <ItemContent class="flex-none text-right">
        <span class="text-sm font-medium">{{ count ?? "..." }}</span>
      </ItemContent>
    </Item>

    <Button variant="outline" size="sm" @click="$emit('view-genres')">
      <GenreIcon class="size-4" />
      {{ $t("settings.view_all_genres") }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import GenreIcon from "@/components/icons/GenreIcon.vue";
import { Button } from "@/components/ui/button";
import { Item, ItemContent, ItemTitle } from "@/components/ui/item";

interface Props {
  count: number | undefined;
}

defineProps<Props>();
defineEmits<{ "view-genres": [] }>();
</script>
