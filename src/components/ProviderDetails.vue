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
          show-menu-btn
          @menu.stop="(evt) => onMenu(evt, providerMapping)"
        >
          <template #prepend>
            <ProviderIcon
              :domain="providerMapping.provider_domain"
              :size="30"
            />
          </template>
          <template #title>
            {{ getProviderName(providerMapping) }}
            <v-chip
              v-if="providerMapping.in_library"
              size="x-small"
              density="compact"
              class="ml-2"
              :title="$t('tooltip.in_provider_library')"
            >
              {{ $t("library") }}
            </v-chip>
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
            />
            <!-- play sample button -->
            <div class="d-flex align-center ga-2">
              <v-btn
                v-if="
                  getBreakpointValue('bp1') &&
                  itemDetails.media_type == MediaType.TRACK
                "
                variant="plain"
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
            </div>
          </template>
        </ListItem>
        <!-- virtual mapping for library -->
        <ListItem
          v-if="itemDetails.provider == 'library'"
          show-menu-btn
          @menu.stop="
            (evt) =>
              onMenu(evt, {
                provider_instance: 'library',
                provider_domain: 'library',
                item_id: itemDetails.item_id,
                available: true,
              })
          "
        >
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
import { copyToClipboard } from "@/helpers/utils";
import { api } from "@/plugins/api";
import {
  MediaType,
  ProviderMapping,
  type MediaItemType,
} from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { getBreakpointValue } from "@/plugins/breakpoint";
import { eventbus } from "@/plugins/eventbus";
import { computed, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";

export interface Props {
  itemDetails: MediaItemType;
}
const props = defineProps<Props>();

const { t } = useI18n();
const expanded = ref(false);
const mappingSearchInProgress = ref(false);

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
  return `${mapping.provider_instance}://${props.itemDetails.media_type}/${mapping.item_id}`;
};

const copyUriToClipboard = async function (uri: string) {
  const success = await copyToClipboard(uri);
  if (success) {
    toast.success(t("uri_copied"));
  } else {
    toast.error(t("uri_copy_failed"));
  }
};

const getProviderName = function (providerMapping: ProviderMapping) {
  const providerInstance = api.getProvider(providerMapping.provider_instance);
  if (providerInstance) {
    return providerInstance.name;
  }
  const providerManifest = api.getProviderManifest(
    providerMapping.provider_domain,
  );
  if (providerManifest) {
    return `${providerManifest.name} (${providerMapping.provider_instance})`;
  }
  return providerMapping.provider_instance;
};

const toggleExpand = function () {
  expanded.value = !expanded.value;
};

const onMenu = function (evt: Event, providerMapping: ProviderMapping) {
  const mouseEvt = evt as MouseEvent;
  const menuItems = [
    {
      label: t("tooltip.copy_uri"),
      icon: "mdi-link",
      action: () => {
        if (providerMapping) {
          copyUriToClipboard(getProviderUri(providerMapping));
        }
      },
    },
  ];
  // visit website button
  if (
    providerMapping.url &&
    !providerMapping.provider_domain.startsWith("file")
  ) {
    menuItems.push({
      label: t("tooltip.open_provider_link"),
      icon: "mdi-open-in-new",
      action: () => {
        openLinkInNewTab(providerMapping.url!);
      },
    });
  }
  // remove mapping option (only for streaming provider mapping)
  if (
    authManager.isAdmin() &&
    api.providers[providerMapping.provider_instance]?.is_streaming_provider
  ) {
    menuItems.push({
      label: t("remove_provider_mapping"),
      icon: "mdi-delete",
      action: async () => {
        if (!confirm(t("remove_provider_mapping_confirm"))) return;
        await api.sendCommand("music/remove_provider_mapping", {
          media_type: props.itemDetails.media_type,
          db_id: props.itemDetails.item_id,
          mapping: providerMapping,
        });
      },
    });
  }

  // open the contextmenu by emitting the event
  eventbus.emit("contextmenu", {
    items: menuItems,
    posX: mouseEvt.clientX,
    posY: mouseEvt.clientY,
  });
};

const searchAllProviders = function () {
  if (!confirm(t("search_all_providers_confirm"))) return;
  mappingSearchInProgress.value = true;
  api
    .sendCommand("music/match_providers", {
      media_type: props.itemDetails.media_type,
      db_id: props.itemDetails.item_id,
    })
    .finally(() => {
      mappingSearchInProgress.value = false;
    });
};

const toolbarMenuItems = computed(() => {
  return [
    // search all providers option (only for library items when streaming providers are available)
    {
      label: "search_all_providers",
      icon: "mdi-database-search",
      action: searchAllProviders,
      overflowAllowed: false,
      disabled: mappingSearchInProgress.value,
      hide:
        props.itemDetails.provider != "library" ||
        !api.hasStreamingProviders.value ||
        !authManager.isAdmin(),
    },
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

<style>
.hiresicon {
  margin-top: 5px;
  margin-right: 15px;
  margin-left: 15px;
  filter: invert(100%);
}

.hiresicondark {
  margin-top: 5px;
  margin-right: 15px;
  margin-left: 15px;
}
</style>
