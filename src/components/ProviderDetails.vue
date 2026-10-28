<template>
  <section style="margin-bottom: 10px">
    <Toolbar
      :title="$t('source_details')"
      :menu-items="toolbarMenuItems"
      @title-clicked="toggleExpand"
    />
    <Separator />
    <div
      v-if="expanded"
      class="p-[10px] in-[.detail-admin]:px-3 in-[.detail-admin]:pt-0 in-[.detail-admin]:pb-3"
    >
      <ItemGroup>
        <Item
          v-for="providerMapping in itemDetails?.provider_mappings"
          :key="providerMapping.provider_instance"
          v-hold="
            (evt: Event) =>
              openMappingMenu(evt, providerMapping.provider_instance)
          "
          size="sm"
          class="gap-7 rounded-(--radius-lg) border-0 px-2"
          :class="{
            'pointer-events-none opacity-50':
              !isMappingAvailable(providerMapping),
          }"
          @click.right.prevent="
            openMappingMenu($event, providerMapping.provider_instance)
          "
        >
          <ItemMedia>
            <ProviderIcon
              :domain="providerMapping.provider_domain"
              :size="30"
              class="mx-[10px]"
            />
          </ItemMedia>
          <ItemContent class="min-w-0 gap-0.5">
            <ItemTitle class="text-base">
              {{ getProviderName(providerMapping) }}
              <Badge
                v-if="providerMapping.in_library"
                variant="secondary"
                class="border-0 bg-muted px-1.5 text-[10px] text-muted-foreground uppercase"
                :title="$t('tooltip.in_provider_library')"
              >
                {{ $t("library") }}
              </Badge>
            </ItemTitle>
            <ItemDescription class="truncate">
              <span v-if="itemDetails.media_type == MediaType.TRACK"
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
                class="cursor-pointer opacity-60"
                :title="$t('tooltip.open_provider_link')"
                @click.prevent="openLinkInNewTab(providerMapping.url)"
                >{{ getProviderUri(providerMapping) }}</a
              >
              <span v-else class="opacity-60" :title="$t('tooltip.copy_uri')">{{
                getProviderUri(providerMapping)
              }}</span>
            </ItemDescription>
          </ItemContent>
          <ItemActions class="gap-1">
            <img
              v-if="providerMapping.audio_format.bit_depth > 16"
              :src="iconHiRes"
              width="30"
              alt=""
              class="mx-2 invert dark:invert-0"
            />
            <Button
              v-if="
                getBreakpointValue('bp1') &&
                itemDetails.media_type == MediaType.TRACK
              "
              variant="ghost"
              size="icon-sm"
              :aria-label="$t('tooltip.play_sample')"
              :title="$t('tooltip.play_sample')"
              :disabled="!isMappingAvailable(providerMapping)"
              @click="playBtnClick(providerMapping)"
            >
              <span
                class="flex size-6 items-center justify-center rounded-full bg-foreground/60 text-background"
              >
                <Pause
                  v-if="isSamplePlaying(providerMapping)"
                  class="size-3"
                  fill="currentColor"
                  :stroke-width="0"
                />
                <Play
                  v-else
                  class="play-icon-centered size-3"
                  fill="currentColor"
                  :stroke-width="0"
                />
              </span>
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              :aria-label="`${$t('more_options')}: ${getProviderName(providerMapping)}`"
              :disabled="!isMappingAvailable(providerMapping)"
              @click.stop="
                openMappingMenu($event, providerMapping.provider_instance)
              "
            >
              <MoreVertical class="size-4" />
            </Button>
          </ItemActions>
        </Item>
        <!-- virtual mapping for library -->
        <Item
          v-if="itemDetails.provider == 'library'"
          v-hold="(evt: Event) => openMappingMenu(evt, LIBRARY_INSTANCE)"
          size="sm"
          class="gap-7 rounded-(--radius-lg) border-0 px-2"
          @click.right.prevent="openMappingMenu($event, LIBRARY_INSTANCE)"
        >
          <ItemMedia>
            <ProviderIcon domain="library" :size="30" class="mx-[10px]" />
          </ItemMedia>
          <ItemContent class="min-w-0 gap-0.5">
            <ItemTitle class="text-base">
              {{ $t("music_assistant_library") }}
            </ItemTitle>
            <ItemDescription class="truncate">
              library://{{ itemDetails.media_type }}/{{ itemDetails.item_id }}
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button
              variant="ghost"
              size="icon-sm"
              :aria-label="`${$t('more_options')}: ${$t('music_assistant_library')}`"
              @click.stop="openMappingMenu($event, LIBRARY_INSTANCE)"
            >
              <MoreVertical class="size-4" />
            </Button>
          </ItemActions>
        </Item>
      </ItemGroup>
    </div>
  </section>
  <GenreExclusionManager
    v-if="
      itemDetails.provider === 'library' &&
      itemDetails.media_type !== MediaType.GENRE
    "
    :media-type="itemDetails.media_type"
    :media-id="itemDetails.item_id"
  />
</template>

<script setup lang="ts">
import {
  ChevronDown,
  ChevronUp,
  DatabaseSearch,
  ExternalLink,
  Link,
  MoreVertical,
  Pause,
  Play,
  Trash2,
} from "@lucide/vue";
import GenreExclusionManager from "@/components/genre/GenreExclusionManager.vue";
import ProviderIcon from "@/components/ProviderIcon.vue";
import { iconHiRes } from "@/components/QualityDetailsBtn.vue";
import Toolbar from "@/components/Toolbar.vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
import { getEventPosition } from "@/composables/useHoldToOpenMenu";
import type { ContextMenuItem } from "@/helpers/context_menu_item";
import { copyToClipboard } from "@/helpers/utils";
import { api } from "@/plugins/api";
import {
  MediaType,
  ProviderMapping,
  Scope,
  type MediaItem,
} from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { getBreakpointValue } from "@/plugins/breakpoint";
import { eventbus } from "@/plugins/eventbus";
import { computed, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";

export interface Props {
  itemDetails: MediaItem;
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
    return;
  }
  // claim the slot before awaiting the url, so a second click while the request is
  // in flight cannot start a second clip that the first would then orphan
  const audio = new Audio();
  demoPlayer[key] = audio;
  api
    .getTrackPreviewUrl(
      providerMapping.provider_instance,
      providerMapping.item_id,
    )
    .then((url) => {
      // the stop path clears the slot; do not start playing a clip nobody wants
      if (demoPlayer[key] !== audio) return;
      audio.src = url;
      return audio.play();
    })
    .catch(() => {
      if (demoPlayer[key] === audio) delete demoPlayer[key];
    });
};

// just enough of a provider mapping to identify an item: the library entry built for
// the menu below carries only these fields, not the full server-sent mapping
type ProviderMappingRef = Pick<
  ProviderMapping,
  "provider_instance" | "provider_domain" | "item_id" | "available" | "url"
>;

const isSamplePlaying = function (providerMapping: ProviderMapping) {
  return !!demoPlayer[
    `${providerMapping.provider_instance}.${providerMapping.item_id}`
  ];
};

const isMappingAvailable = function (providerMapping: ProviderMapping) {
  return (
    providerMapping.available &&
    !!api.getProvider(providerMapping.provider_instance)
  );
};

const getProviderUri = function (mapping: ProviderMappingRef) {
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

const LIBRARY_INSTANCE = "library";

const libraryMapping = computed<ProviderMappingRef>(() => ({
  provider_instance: LIBRARY_INSTANCE,
  provider_domain: LIBRARY_INSTANCE,
  item_id: props.itemDetails.item_id,
  available: true,
  url: null,
}));

// v-hold keeps its first handler, so look the mapping up when the menu opens
const openMappingMenu = function (evt: Event, providerInstance: string) {
  if (providerInstance === LIBRARY_INSTANCE) {
    onMenu(evt, libraryMapping.value);
    return;
  }
  const mapping = props.itemDetails.provider_mappings.find(
    (x) => x.provider_instance === providerInstance,
  );
  if (!mapping || !isMappingAvailable(mapping)) return;
  onMenu(evt, mapping);
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

const onMenu = function (evt: Event, providerMapping: ProviderMappingRef) {
  const menuItems: ContextMenuItem[] = [
    {
      label: t("tooltip.copy_uri"),
      icon: Link,
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
      icon: ExternalLink,
      action: () => {
        openLinkInNewTab(providerMapping.url!);
      },
    });
  }
  // remove mapping option (only for streaming provider mapping)
  if (
    authManager.hasScope(Scope.LIBRARY_MANAGE) &&
    api.providers[providerMapping.provider_instance]?.is_streaming_provider
  ) {
    menuItems.push({
      label: t("remove_provider_mapping"),
      icon: Trash2,
      action: () => {
        eventbus.emit("deleteConfirmationDialog", {
          title: t("remove_provider_mapping"),
          message: t("remove_provider_mapping_confirm"),
          confirmLabel: t("remove_provider_mapping"),
          onConfirm: () =>
            api.sendCommand("music/remove_provider_mapping", {
              media_type: props.itemDetails.media_type,
              db_id: props.itemDetails.item_id,
              mapping: providerMapping,
            }),
        });
      },
    });
  }

  // open the contextmenu by emitting the event
  const position = getEventPosition(evt);
  eventbus.emit("contextmenu", {
    items: menuItems,
    posX: position.x,
    posY: position.y,
  });
};

const searchAllProviders = function () {
  eventbus.emit("deleteConfirmationDialog", {
    title: t("search_all_providers"),
    message: t("search_all_providers_confirm"),
    confirmLabel: t("search"),
    destructive: false,
    onConfirm: () => {
      mappingSearchInProgress.value = true;
      api
        .sendCommand("music/match_providers", {
          media_type: props.itemDetails.media_type,
          db_id: props.itemDetails.item_id,
        })
        .finally(() => {
          mappingSearchInProgress.value = false;
        });
    },
  });
};

const toolbarMenuItems = computed(() => {
  return [
    // search all providers option (only for library items when streaming providers are available)
    {
      label: "search_all_providers",
      icon: DatabaseSearch,
      action: searchAllProviders,
      overflowAllowed: false,
      disabled: mappingSearchInProgress.value,
      hide:
        props.itemDetails.provider != "library" ||
        !api.hasStreamingProviders.value ||
        !authManager.hasScope(Scope.LIBRARY_MANAGE),
    },
    // toggle expand
    {
      label: "tooltip.collapse_expand",
      icon: expanded.value ? ChevronUp : ChevronDown,
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
