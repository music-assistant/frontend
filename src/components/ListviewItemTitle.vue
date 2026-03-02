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
  </div>
  <!-- explicit icon -->
  <TooltipProvider v-if="item && item.metadata" location="bottom">
    <Tooltip>
      <TooltipTrigger>
        <v-icon
          v-if="parseBool(item.metadata.explicit || false)"
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

  <!-- <v-tooltip v-if="item && item.metadata" location="bottom">
    <template #activator="{ props }">
      <v-icon
        v-if="parseBool(item.metadata.explicit || false)"
        :class="{ 'explicit-icon-margin-left': showCheckboxes }"
        v-bind="props"
        icon="mdi-alpha-e-box"
        width="35"
      />
    </template>
    <span>{{ $t("tooltip.explicit") }}</span>
  </v-tooltip> -->
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
  margin-left: 0.3em;
}
</style>
