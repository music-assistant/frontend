<template>
  <section style="margin-bottom: 10px">
    <Toolbar
      :title="$t('mapped_providers')"
      :menu-items="toolbarMenuItems"
      @title-clicked="toggleExpand"
    />
    <v-divider />
    <Container v-if="expanded">
      <v-list>
        <ListItem
          v-for="providerMapping in itemDetails?.provider_mappings"
          :key="providerMapping.provider_instance"
          :disabled="
            !providerMapping.available ||
            !api.getProvider(providerMapping.provider_instance)
          "
        >
          <template #prepend>
            <ProviderIcon
              :domain="providerMapping.provider_domain"
              :size="30"
            />
          </template>
          <template #title>
            {{ api.getProvider(providerMapping.provider_instance)?.name }}
          </template>
          <template #subtitle>
            <span
              v-if="
                itemDetails.media_type == MediaType.TRACK &&
                providerMapping.audio_format
              "
              >{{ providerMapping.audio_format.content_type }} |
              {{ providerMapping.audio_format.sample_rate / 1000 }}kHz/{{
                providerMapping.audio_format.bit_depth
              }}
              bits |
            </span>

            <a
              v-if="
                providerMapping.url &&
                !providerMapping.provider_domain.startsWith('file')
              "
              style="opacity: 0.4"
              :title="$t('tooltip.open_provider_link')"
              @click.prevent="openLinkInNewTab(providerMapping.url)"
              >{{ getProviderUri(providerMapping) }}</a
            >
            <span v-else style="opacity: 0.4" :title="$t('copy_uri')">{{
              getProviderUri(providerMapping)
            }}</span>
          </template>
          <template #append>
            <!-- hi res icon -->
            <v-img
              v-if="
                providerMapping.audio_format &&
                providerMapping.audio_format.bit_depth > 16
              "
              :src="iconHiRes"
              width="30"
              :class="
                $vuetify.theme.current.dark ? 'hiresicondark' : 'hiresicon'
              "
              style="margin-right: 15px"
            />
            <!-- play sample button -->
            <div class="d-flex align-center ga-2">
              <v-btn
                v-if="
                  getBreakpointValue('bp1') &&
                  itemDetails.media_type == MediaType.TRACK
                "
                :icon="
                  demoPlayer[
                    `${providerMapping.provider_instance}.${providerMapping.item_id}`
                  ]
                    ? 'mdi-pause'
                    : 'mdi-play-circle'
                "
                :title="$t('tooltip.play_sample')"
                @click="playBtnClick(providerMapping)"
              />
              <!-- visit website button -->
              <v-btn
                v-if="
                  providerMapping.url &&
                  !providerMapping.provider_domain.startsWith('file')
                "
                icon="mdi-open-in-new"
                :title="$t('tooltip.open_provider_link')"
                @click.prevent="openLinkInNewTab(providerMapping.url)"
              />
              <!-- copy URI to clipboard button -->
              <v-btn
                icon="mdi-link"
                :title="$t('tooltip.copy_uri')"
                @click="copyUriToClipboard(getProviderUri(providerMapping))"
              />
            </div>
          </template>
        </ListItem>
        <ListItem v-if="itemDetails.provider == 'library'">
          <template #prepend>
            <ProviderIcon domain="library" :size="30" />
          </template>
          <template #title>{{ $t("music_assistant_library") }}</template>
          <template #subtitle>
            <span
              >library://{{ itemDetails.media_type }}/{{
                itemDetails.item_id
              }}</span
            >
          </template>
          <template #append>
            <v-btn
              icon="mdi-link"
              :title="$t('tooltip.copy_uri')"
              @click="
                copyUriToClipboard(
                  `library://${itemDetails.media_type}/${itemDetails.item_id}`,
                )
              "
            />
          </template>
        </ListItem>
      </v-list>
    </Container>
  </section>
</template>

<script setup lang="ts">
import Container from "@/components/Container.vue";
import ListItem from "@/components/ListItem.vue";
import ProviderIcon from "@/components/ProviderIcon.vue";
import { iconHiRes } from "@/components/QualityDetailsBtn.vue";
import Toolbar from "@/components/Toolbar.vue";
import { api } from "@/plugins/api";
import {
  MediaType,
  ProviderMapping,
  type MediaItemType,
} from "@/plugins/api/interfaces";
import { getBreakpointValue } from "@/plugins/breakpoint";
import { computed, reactive, ref } from "vue";
import { copyToClipboard } from "@/helpers/utils";
import { toast } from "vuetify-sonner";
import { useI18n } from "vue-i18n";

export interface Props {
  itemDetails: MediaItemType;
}
const props = defineProps<Props>();

const { t } = useI18n();
const expanded = ref(false);

const openLinkInNewTab = function (url: string) {
  window.open(url, "_blank");
};

const demoPlayer = reactive<{ [item_id: string]: HTMLAudioElement }>({});

const playBtnClick = function (providerMapping: ProviderMapping) {
  const key = `${providerMapping.provider_instance}.${providerMapping.item_id}`;
  const existing = demoPlayer[key];
  if (existing) {
    existing.load();
    delete demoPlayer[key];
  } else {
    const audio = new Audio(
      getPreviewUrl(providerMapping.provider_instance, providerMapping.item_id),
    );
    demoPlayer[key] = audio;
    audio.play();
  }
};
const getPreviewUrl = function (provider: string, item_id: string) {
  return `${
    api.baseUrl
  }/preview?item_id=${encodeURIComponent(item_id)}&provider=${provider}`;
};

const getProviderUri = function (mapping: ProviderMapping) {
  return `${api.getProvider(mapping.provider_instance)?.lookup_key}://${props.itemDetails.media_type}/${mapping.item_id}`;
};

const copyUriToClipboard = async function (uri: string) {
  const success = await copyToClipboard(uri);
  if (success) {
    toast.success(t("uri_copied"));
  } else {
    toast.error(t("uri_copy_failed"));
  }
};

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
</script>
