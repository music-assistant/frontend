<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { SidebarGroupLabel } from "@/components/ui/sidebar";
import { Eye, EyeOff, Pencil } from "@lucide/vue";
import { nextTick, ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  updateMenuSectionConfig,
  type MenuSectionId,
} from "./utils/getMenuItems";

const props = defineProps<{
  sectionId: MenuSectionId;
  // Resolved display label (custom label or translated default).
  label: string;
  // Translated default label (to detect when a rename is a no-op).
  defaultLabel: string;
  labelHidden?: boolean;
  editMode?: boolean;
}>();

const { t } = useI18n();

const renaming = ref(false);
const renameValue = ref("");
const renameInput = ref<HTMLInputElement | null>(null);

const startRename = () => {
  renameValue.value = props.label;
  renaming.value = true;
  nextTick(() => renameInput.value?.focus());
};

const cancelRename = () => {
  renaming.value = false;
};

const commitRename = async () => {
  if (!renaming.value) return;
  renaming.value = false;
  const value = renameValue.value.trim();
  // An empty value or the default label clears the customization.
  const label = !value || value === props.defaultLabel ? undefined : value;
  await updateMenuSectionConfig(props.sectionId, { label });
};

const toggleLabelHidden = async () => {
  await updateMenuSectionConfig(props.sectionId, {
    hide_label: !props.labelHidden,
  });
};
</script>

<template>
  <div v-if="editMode" class="nav-edit-header">
    <input
      v-if="renaming"
      ref="renameInput"
      v-model="renameValue"
      class="nav-edit-rename-input"
      :placeholder="defaultLabel"
      @keydown.enter.prevent="commitRename"
      @keydown.esc="cancelRename"
      @blur="commitRename"
    />
    <template v-else>
      <SidebarGroupLabel
        class="nav-edit-label"
        :class="{ 'nav-edit-label-off': labelHidden }"
        @click="startRename"
      >
        {{ label }}
      </SidebarGroupLabel>
      <div class="nav-edit-header-actions">
        <Button
          variant="ghost"
          size="icon"
          class="h-6 w-6"
          :title="t('menu_section_rename')"
          @click="startRename"
        >
          <Pencil class="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          class="h-6 w-6"
          :title="
            t(
              labelHidden
                ? 'menu_section_show_label'
                : 'menu_section_hide_label',
            )
          "
          @click="toggleLabelHidden"
        >
          <Eye v-if="!labelHidden" class="size-3.5" />
          <EyeOff v-else class="size-3.5" />
        </Button>
      </div>
    </template>
  </div>
  <SidebarGroupLabel v-else-if="label && !labelHidden">
    {{ label }}
  </SidebarGroupLabel>
</template>

<style scoped>
.nav-edit-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.25rem;
  padding-right: 0.5rem;
}

.nav-edit-label {
  flex: 1;
  min-width: 0;
  cursor: text;
}

.nav-edit-label-off {
  text-decoration: line-through;
  opacity: 0.35;
}

.nav-edit-header-actions {
  display: flex;
  align-items: center;
  opacity: 0.7;
}

.nav-edit-rename-input {
  flex: 1;
  min-width: 0;
  margin-left: 1rem;
  height: 1.75rem;
  padding: 0 0.25rem;
  font-size: 0.875rem;
  background: transparent;
  border: none;
  border-bottom: 1px solid hsl(var(--sidebar-border));
  border-radius: 0;
  color: hsl(var(--sidebar-foreground));
  outline: none;
}
</style>
