<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSidebar } from "@/components/ui/sidebar";
import { toggleHAMenu } from "@/plugins/homeassistant";
import { computed } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();
const { state, isMobile, setOpenMobile } = useSidebar();

const isCollapsed = computed(() => state.value === "collapsed");

const handleClick = () => {
  // Both menus over the same screen would only cover each other up.
  if (isMobile.value) setOpenMobile(false);
  toggleHAMenu();
};
</script>

<template>
  <Tooltip>
    <TooltipTrigger as-child>
      <Button
        variant="outline"
        :size="isCollapsed ? 'icon' : 'default'"
        :class="isCollapsed ? 'mx-auto' : 'w-full justify-start'"
        :aria-label="t('home_assistant_menu')"
        @click="handleClick"
      >
        <img
          src="@/assets/home-assistant-logo.svg"
          alt=""
          class="size-4 shrink-0"
        />
        <span v-if="!isCollapsed" class="truncate">
          {{ t("home_assistant_menu") }}
        </span>
      </Button>
    </TooltipTrigger>
    <TooltipContent side="right" align="center" :hidden="!isCollapsed">
      {{ t("home_assistant_menu") }}
    </TooltipContent>
  </Tooltip>
</template>
