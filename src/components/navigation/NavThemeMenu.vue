<script setup lang="ts">
import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
  isThemePreference,
  THEME_PREFERENCES,
  useThemePreference,
} from "@/composables/useThemePreference";
import { Palette } from "@lucide/vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();
const { themePreference, setThemePreference } = useThemePreference();

const handleThemeChange = async (value: unknown) => {
  if (!isThemePreference(value) || value === themePreference.value) return;
  await setThemePreference(value);
};
</script>

<template>
  <DropdownMenuSub>
    <DropdownMenuSubTrigger>
      <Palette class="size-[18px]" />
      {{ t("settings.theme.label") }}
    </DropdownMenuSubTrigger>
    <DropdownMenuSubContent class="min-w-52">
      <DropdownMenuRadioGroup
        :model-value="themePreference"
        @update:model-value="handleThemeChange"
      >
        <DropdownMenuRadioItem
          v-for="preference in THEME_PREFERENCES"
          :key="preference"
          :value="preference"
        >
          {{ t(`settings.theme.options.${preference}`) }}
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </DropdownMenuSubContent>
  </DropdownMenuSub>
</template>
