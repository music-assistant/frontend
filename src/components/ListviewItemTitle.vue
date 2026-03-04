<!-- eslint-disable vue/no-template-shadow -->
<template v-if="!showCheckboxes">
  <span v-if="item.media_type == MediaType.FOLDER">
    <span>{{ getBrowseFolderName(item as BrowseFolder, t) }}</span>
  </span>
  <div class="checkbox-label">
    {{ displayName }}
    <span v-if="'version' in item && item.version"> ({{ item.version }}) </span>
    <span
      v-if="item.media_type == MediaType.TRACK && item.metadata?.release_date"
    >
      ({{ new Date(item.metadata.release_date).getFullYear() }})
    </span>
    <!-- explicit icon -->
    <template
      v-if="item && item.metadata && parseBool(item.metadata.explicit || false)"
    >
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <v-icon
              :class="{ 'explicit-icon-margin-left': showCheckboxes }"
              icon="mdi-alpha-e-box"
              width="35"
            />
          </TooltipTrigger>
          <TooltipContent>
            <span>{{ $t("tooltip.explicit") }}</span>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </template>
  </div>
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
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// properties
export interface Props {
  displayName: string;
  item: MediaItemType;
  showCheckboxes: boolean;
}

// global refs
const { t } = useI18n();

const compProps = withDefaults(defineProps<Props>(), {
  displayName: "",
  showCheckboxes: false,
});
</script>

<style scoped>
.checkbox-label {
  font-weight: 500;
}

/* When checkbox is displayed, explicit icon will be shown to the right of the title.
   This adds a bit of spacing between the title and the explicit icon. */
.explicit-icon-margin-left {
  margin-left: 0.1em;
}
</style>
