<template>
  <section style="margin-bottom: 10px">
    <Toolbar
      :title="$t('chapters')"
      :menu-items="toolbarMenuItems"
      @title-clicked="toggleExpand"
    />
    <v-divider />
    <Container v-if="expanded">
      <v-list>
        <v-list-item
          v-for="chapter in itemDetails?.metadata?.chapters"
          :key="chapter.position"
          :disabled="!itemIsAvailable(itemDetails)"
          @click="chapterClicked(chapter)"
        >
          <template #prepend>
            <div style="width: 50px">
              <v-chip>
                {{ chapter.position }}
              </v-chip>
            </div>
          </template>
          <template #title>
            <div>{{ chapter.name }}</div>
          </template>
          <template #append>
            <span v-if="chapter.end" class="text-caption"
              >{{ formatDuration(chapter.end - chapter.start) }}
            </span>
          </template>
        </v-list-item>
      </v-list>
    </Container>
  </section>
</template>

<script setup lang="ts">
import Container from "@/components/Container.vue";
import Toolbar from "@/components/Toolbar.vue";
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
