<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { toggleHAMenu } from "@/plugins/homeassistant";
import type { HTMLAttributes } from "vue";
import { useI18n } from "vue-i18n";

const props = defineProps<{
  /** Render icon-only, for hosts too narrow to carry the label. */
  collapsed?: boolean;
  class?: HTMLAttributes["class"];
}>();

const emit = defineEmits<{ click: [] }>();

const { t } = useI18n();

const handleClick = () => {
  emit("click");
  toggleHAMenu();
};
</script>

<template>
  <Button
    variant="outline"
    :size="props.collapsed ? 'icon' : 'default'"
    :class="props.class"
    :aria-label="t('home_assistant_menu')"
    @click="handleClick"
  >
    <img
      src="@/assets/home-assistant-logo.svg"
      alt=""
      class="size-4 shrink-0"
    />
    <span v-if="!props.collapsed" class="truncate">
      {{ t("home_assistant_menu") }}
    </span>
  </Button>
</template>
