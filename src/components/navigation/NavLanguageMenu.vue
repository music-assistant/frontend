<script setup lang="ts">
import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { useUserPreferences } from "@/composables/userPreferences";
import { getLocaleOptions, i18n, resolveLocale } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { Languages } from "@lucide/vue";
import { computed } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();
const { setPreference } = useUserPreferences();

const availableLocales = computed(() =>
  Array.from(i18n.global.availableLocales),
);
const languagePreference = computed(
  () =>
    (store.currentUser?.preferences?.language as string | undefined) || "auto",
);
const selectedLanguage = computed(() =>
  languagePreference.value === "auto"
    ? "auto"
    : resolveLocale(languagePreference.value, availableLocales.value),
);
const languageOptions = computed(() => [
  {
    value: "auto",
    label: t("settings.language.options.auto"),
  },
  ...getLocaleOptions(availableLocales.value, i18n.global.locale.value),
]);

const handleLanguageChange = async (value: unknown) => {
  if (typeof value !== "string" || value === languagePreference.value) return;

  await setPreference("language", value);
  i18n.global.locale.value =
    value === "auto"
      ? resolveLocale(navigator.language, availableLocales.value)
      : resolveLocale(value, availableLocales.value);
};
</script>

<template>
  <DropdownMenuSub>
    <DropdownMenuSubTrigger>
      <Languages class="size-[18px]" />
      {{ t("settings.language.label") }}
    </DropdownMenuSubTrigger>
    <DropdownMenuSubContent class="max-h-80 min-w-52 overflow-y-auto">
      <DropdownMenuRadioGroup
        :model-value="selectedLanguage"
        @update:model-value="handleLanguageChange"
      >
        <DropdownMenuRadioItem
          v-for="option in languageOptions"
          :key="option.value"
          :value="option.value"
        >
          {{ option.label }}
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </DropdownMenuSubContent>
  </DropdownMenuSub>
</template>
