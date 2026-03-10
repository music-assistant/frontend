<template>
  <section v-if="isAdmin" style="margin-bottom: 10px">
    <Toolbar
      :title="exclusionTitle"
      :menu-items="toolbarMenuItems"
      @title-clicked="toggleSection"
    />
    <v-divider />
    <Container v-if="sectionExpanded">
      <v-list>
        <ListItem
          v-for="genre in exclusions"
          :key="genre.item_id"
          show-menu-btn
          @menu.stop="(evt) => onMenu(evt, genre)"
        >
          <template #prepend>
            <div
              style="
                width: 30px;
                margin-left: 10px;
                margin-right: 10px;
                display: flex;
                align-items: center;
              "
            >
              <Compass :size="30" />
            </div>
          </template>
          <template #title>{{
            getGenreDisplayName(genre.name, genre.translation_key, t, te)
          }}</template>
        </ListItem>
      </v-list>
    </Container>
  </section>
</template>

<script setup lang="ts">
import Container from "@/components/Container.vue";
import ListItem from "@/components/ListItem.vue";
import Toolbar, { ToolBarMenuItem } from "@/components/Toolbar.vue";
import { getGenreDisplayName } from "@/helpers/utils";
import { api } from "@/plugins/api";
import { Genre, MediaType } from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { eventbus } from "@/plugins/eventbus";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Compass, ChevronUp, ChevronDown } from "lucide-vue-next";

interface Props {
  mediaType: MediaType;
  mediaId: string;
}

const props = defineProps<Props>();

const { t, te } = useI18n();

const isAdmin = computed(() => authManager.isAdmin());
const sectionExpanded = ref(false);
const operationInProgress = ref(false);
const exclusions = ref<Genre[]>([]);

const exclusionTitle = computed(
  () => `${t("genre_exclusions")} (${exclusions.value.length})`,
);

const toolbarMenuItems = computed<ToolBarMenuItem[]>(() => [
  {
    label: "tooltip.collapse_expand",
    icon: sectionExpanded.value ? ChevronUp : ChevronDown,
    action: toggleSection,
    overflowAllowed: false,
  },
]);

const loadExclusions = async () => {
  try {
    exclusions.value = await api.getGenreExclusionsForItem(
      props.mediaType,
      props.mediaId,
    );
  } catch {
    exclusions.value = [];
  }
};

const removeExclusion = async (genre: Genre) => {
  operationInProgress.value = true;
  try {
    await api.removeGenreExclusion(
      genre.item_id,
      props.mediaType,
      props.mediaId,
    );
    exclusions.value = exclusions.value.filter(
      (g) => g.item_id !== genre.item_id,
    );
  } finally {
    operationInProgress.value = false;
  }
};

const onMenu = (evt: Event, genre: Genre) => {
  const mouseEvt = evt as MouseEvent;
  eventbus.emit("contextmenu", {
    items: [
      {
        label: "remove_genre_exclusion",
        icon: "mdi-delete",
        action: () => removeExclusion(genre),
        disabled: operationInProgress.value,
      },
    ],
    posX: mouseEvt.clientX,
    posY: mouseEvt.clientY,
  });
};

const toggleSection = () => {
  sectionExpanded.value = !sectionExpanded.value;
};

onMounted(() => {
  loadExclusions();
  eventbus.on("genreExcluded", loadExclusions);
});

onBeforeUnmount(() => {
  eventbus.off("genreExcluded", loadExclusions);
});

watch(
  () => props.mediaId,
  () => loadExclusions(),
);
</script>
