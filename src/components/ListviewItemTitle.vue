<template>
  <span
    v-if="item.media_type == MediaType.FOLDER"
    class="v-list-item-title"
    :class="{ 'checkbox-label': showCheckboxes }"
  >
    <span>{{ getBrowseFolderName(item as BrowseFolder, t) }}</span>
  </span>
  <span
    v-else
    :class="{
      'is-playing': isPlaying,
      'checkbox-label': showCheckboxes,
      'album-track-title': albumTrackView,
    }"
    class="v-list-item-title"
  >
    {{ displayName }}
    <span v-if="'version' in item && item.version"> ({{ item.version }}) </span>
    <span
      v-if="item.media_type == MediaType.TRACK && item.metadata?.release_date"
    >
      ({{ new Date(item.metadata.release_date).getFullYear() }})
    </span>
  </span>
  <!-- explicit icon -->
  <template
    v-if="item && item.metadata && parseBool(item.metadata.explicit || false)"
  >
    <Tooltip>
      <TooltipTrigger as-child>
        <span
          :aria-label="t('tooltip.explicit')"
          tabindex="0"
          :class="{ 'explicit-icon-align': albumTrackView }"
        >
          <v-icon
            :class="{ 'explicit-icon-margin-left': showCheckboxes }"
            icon="mdi-alpha-e-box"
            width="35"
          />
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <span>{{ $t("tooltip.explicit") }}</span>
      </TooltipContent>
    </Tooltip>
  </template>
</template>

<script setup lang="ts">
import { getBrowseFolderName, parseBool } from "@/helpers/utils";
import {
  MediaType,
  type BrowseFolder,
  type MediaItemType,
} from "@/plugins/api/interfaces";
import { useI18n } from "vue-i18n";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// properties
export interface Props {
  displayName: string;
  item: MediaItemType;
  showCheckboxes: boolean;
  isPlaying: boolean;
  albumTrackView?: boolean;
}

// global refs
const { t } = useI18n();

withDefaults(defineProps<Props>(), {
  displayName: "",
  showCheckboxes: false,
  isPlaying: false,
  albumTrackView: false,
});
</script>

<style scoped>
.checkbox-label {
  margin-left: 23px;
}

.album-track-title {
  font-size: 0.9375rem;
  font-weight: 500;
  white-space: normal;
  overflow: hidden;
  display: -webkit-inline-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  vertical-align: middle;
}

/* Vertically center the explicit icon against the title in the album track view. */
.explicit-icon-align {
  display: inline-flex;
  vertical-align: middle;
  margin-left: 12px;
}

/* When checkbox is displayed, explicit icon will be shown to the right of the title.
   This adds a bit of spacing between the title and the explicit icon. */
.explicit-icon-margin-left {
  margin-left: 0.1em;
}
</style>
