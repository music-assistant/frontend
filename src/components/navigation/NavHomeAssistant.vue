<script setup lang="ts">
import HomeAssistantMenuButton from "@/components/HomeAssistantMenuButton.vue";
import { useSidebar } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { computed } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();
const { state, isMobile, setOpenMobile } = useSidebar();

const isCollapsed = computed(() => state.value === "collapsed");

const handleClick = () => {
  // Both menus over the same screen would only cover each other up.
  if (isMobile.value) setOpenMobile(false);
};
</script>

<template>
  <Tooltip>
    <TooltipTrigger as-child>
      <HomeAssistantMenuButton
        :collapsed="isCollapsed"
        :class="isCollapsed ? 'mx-auto' : 'w-full justify-start'"
        @click="handleClick"
      />
    </TooltipTrigger>
    <TooltipContent side="right" align="center" :hidden="!isCollapsed">
      {{ t("home_assistant_menu") }}
    </TooltipContent>
  </Tooltip>
</template>
