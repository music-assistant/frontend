<template>
  <section style="margin-bottom: 10px">
    <Toolbar
      :title="$t('chapters')"
      :menu-items="toolbarMenuItems"
      @title-clicked="toggleExpand"
    />
    <Separator />
    <Container v-if="expanded">
      <div role="list">
        <Item
          v-for="chapter in itemDetails?.metadata?.chapters"
          :key="chapter.position"
          :disabled="!itemIsAvailable(itemDetails)"
          class="cursor-pointer"
          @click="chapterClicked(chapter)"
        >
          <ItemMedia>
            <Badge variant="secondary">
              {{ chapter.position }}
            </Badge>
          </ItemMedia>
          <ItemContent class="flex-1">
            <ItemTitle>{{ chapter.name }}</ItemTitle>
          </ItemContent>
          <span
            v-if="chapter.end"
            class="text-xs text-muted-foreground ml-auto shrink-0"
            >{{ formatDuration(chapter.end - chapter.start) }}
          </span>
        </Item>
      </div>
    </Container>
  </section>
</template>

<script setup lang="ts">
import Container from "@/components/Container.vue";
import Toolbar from "@/components/Toolbar.vue";
import { Badge } from "@/components/ui/badge";
import { Item, ItemContent, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
import { formatDuration } from "@/helpers/utils";
import { api } from "@/plugins/api";
import { itemIsAvailable } from "@/plugins/api/helpers";
import { MediaItemChapter, type MediaItemType } from "@/plugins/api/interfaces";
import { computed, ref } from "vue";

export interface Props {
  itemDetails: MediaItemType;
}
const props = defineProps<Props>();

const expanded = ref(true);

const toggleExpand = function () {
  expanded.value = !expanded.value;
};

const toolbarMenuItems = computed(() => {
  return [
    // toggle expand
    {
      label: "tooltip.collapse_expand",
      icon: expanded.value ? "mdi-chevron-up" : "mdi-chevron-down",
      action: toggleExpand,
      overflowAllowed: false,
    },
  ];
});

const chapterClicked = function (chapter: MediaItemChapter) {
  if (!props.itemDetails || !itemIsAvailable(props.itemDetails)) return;
  api.playMedia(
    props.itemDetails.uri,
    undefined,
    undefined,
    chapter.position.toString(),
  );
};
</script>
