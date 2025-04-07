<template>
  <section style="margin-bottom: 10px">
    <Toolbar
      :title="$t('images')"
      :menu-items="toolbarMenuItems"
      @title-clicked="toggleExpand"
    />
    <v-divider />
    <Container v-if="expanded">
      <v-row v-for="imgType of ImageType" :key="imgType">
        <v-col
          v-for="(image, idx) in modelValue.filter((x) => x.type == imgType)"
          :key="image.path"
          cols="12"
          :class="`col-${panelViewItemResponsive($vuetify.display.width)}`"
        >
          <v-hover v-slot="{ props }">
            <v-card
              v-hold="
                (e: PointerEvent | TouchEvent) => {
                  onMenu(e, image);
                }
              "
              v-bind="props"
              tile
              hover
              class="panel-item"
              @click="
                (e: PointerEvent) => {
                  onClick(e, image);
                }
              "
              @click.right.prevent="
                (e: PointerEvent | TouchEvent) => {
                  onMenu(e, image);
                }
              "
            >
              <v-img
                :src="getImageURL(image, 256)"
                class="bg-grey-lighten-2"
                width="100%"
              >
                <template #placeholder>
                  <v-row
                    align="center"
                    class="fill-height ma-0"
                    justify="center"
                  >
                    <v-progress-circular color="grey-lighten-5" indeterminate />
                  </v-row>
                </template>
              </v-img>

              <v-list-item
                variant="text"
                slim
                tile
                density="compact"
                class="panel-item-details"
              >
                <v-list-item-title width="95%">
                  {{ $t("image_type") + ": " + image.type }}
                </v-list-item-title>
                <v-list-item-subtitle
                  class="line-clamp-1"
                  style="margin-right: 25px"
                >
                  {{
                    $t("image_source") + ": " + getProviderName(image.provider)
                  }}
                </v-list-item-subtitle>
                <v-icon
                  v-if="idx == 0"
                  size="x-large"
                  style="position: absolute; right: 0; bottom: 5px"
                  color="orange"
                  :title="$t('tooltip.primary_image')"
                  >mdi-star-box</v-icon
                >
              </v-list-item>
            </v-card>
          </v-hover>
        </v-col>
      </v-row>
    </Container>
  </section>
</template>

<script setup lang="ts">
import { getImageURL } from "@/components/MediaItemThumb.vue";
import { ImageType, type MediaItemImage } from "@/plugins/api/interfaces";
import { panelViewItemResponsive } from "@/helpers/utils";
import { api } from "@/plugins/api";
import Container from "@/components/mods/Container.vue";
import Toolbar from "@/components/Toolbar.vue";
import { computed, ref } from "vue";
import { eventbus } from "@/plugins/eventbus";

export interface Props {
  modelValue: MediaItemImage[];
}
const compProps = defineProps<Props>();

const expanded = ref(false);

const emit = defineEmits(["update:modelValue"]);

const openLinkInNewTab = function (url: string) {
  window.open(url, "_blank");
};

const onMenu = function (
  evt: PointerEvent | TouchEvent,
  image: MediaItemImage,
) {
  const posX = "clientX" in evt ? evt.clientX : evt.touches[0].clientX;
  const posY = "clientY" in evt ? evt.clientY : evt.touches[0].clientY;

  // open the contextmenu by emitting the event
  eventbus.emit("contextmenu", {
    items: [
      {
        label: "image_make_primary",
        icon: "mdi-star-box",
        action: () => {
          makeImagePrimary(image);
        },
      },
    ],
    posX: posX,
    posY: posY,
  });
};

const getProviderName = function (provider: string) {
  if (api.getProvider(provider)) return api.getProvider(provider)!.name;
  return provider;
};

const onClick = function (evt: PointerEvent, image: MediaItemImage) {
  openLinkInNewTab(getImageURL(image));
};

const toggleExpand = function () {
  expanded.value = !expanded.value;
};

const makeImagePrimary = function (image: MediaItemImage) {
  const images = [image];
  images.push(...compProps.modelValue.filter((x) => x != image));
  emit("update:modelValue", images);
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
</script>

<style scoped>
/* ThumbView panel columns */
.col-2 {
  width: 50%;
  max-width: 50%;
  flex-basis: 50%;
  padding: 8px;
}
.col-3 {
  width: 33.3%;
  max-width: 33.3%;
  flex-basis: 33.3%;
  padding: 8px;
}
.col-4 {
  width: 25%;
  max-width: 25%;
  flex-basis: 25%;
  padding: 8px;
}
.col-5 {
  width: 20%;
  max-width: 20%;
  flex-basis: 20%;
  padding: 8px;
}
.col-6 {
  width: 16.6%;
  max-width: 16.6%;
  flex-basis: 16.6%;
  padding: 8px;
}
.col-7 {
  width: 14.2%;
  max-width: 14.2%;
  flex-basis: 14.2%;
  padding: 8px;
}
.col-8 {
  width: 12.5%;
  max-width: 12.5%;
  flex-basis: 12.5%;
  padding: 8px;
}
.col-9 {
  width: 11.1%;
  max-width: 11.1%;
  flex-basis: 11.1%;
  padding: 8px;
}

.v-list-item--density-compact {
  padding: 5px !important;
}

panel-item-details :deep(.v-list-item__content) {
  height: 30px;
}
</style>
