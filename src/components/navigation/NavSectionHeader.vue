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

const toggleRename = () => {
  if (renaming.value) {
    void commitRename();
    return;
  }
  startRename();
};

const toggleLabelHidden = async () => {
  await updateMenuSectionConfig(props.sectionId, {
    hide_label: !props.labelHidden,
  });
};
</script>

<template>
  <div v-if="editMode" class="nav-edit-header mb-1 md:mb-0">
    <input
      v-if="renaming"
      ref="renameInput"
      v-model="renameValue"
      class="nav-edit-rename-input md:mb-1"
      :placeholder="defaultLabel"
      @keydown.enter.prevent="commitRename"
      @keydown.esc="cancelRename"
      @blur="commitRename"
    />
    <SidebarGroupLabel
      v-else
      class="nav-edit-label inline-flex min-w-0 items-center gap-1 text-sidebar-foreground h-10 text-sm transition-[color,font-weight] duration-150 md:mb-1"
      :class="{ 'nav-edit-label-off': labelHidden }"
      @click="startRename"
    >
      {{ label }}
    </SidebarGroupLabel>
    <div class="nav-edit-header-actions">
      <Button
        variant="ghost"
        size="icon"
        class="h-6 w-6 hover:text-primary"
        :class="renaming ? 'text-primary' : 'text-sidebar-foreground/70'"
        :title="t('menu_section_rename')"
        @mousedown.prevent
        @click="toggleRename"
      >
        <Pencil class="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        class="h-6 w-6"
        :title="
          t(labelHidden ? 'menu_section_show_label' : 'menu_section_hide_label')
        "
        @click="toggleLabelHidden"
      >
        <Eye v-if="!labelHidden" class="size-4" />
        <EyeOff v-else class="size-4" />
      </Button>
    </div>
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
  opacity: 1;
}

.nav-edit-rename-input {
  flex: 1;
  min-width: 0;
  margin-left: 0;
  height: 40px;
  padding: 0 0.5rem;
  font-size: 0.875rem;
  background: transparent;
  border: none;
  border-bottom: 1px solid hsl(var(--sidebar-border));
  border-radius: 0;
  color: hsl(var(--sidebar-foreground));
  outline: none;
}
</style>
