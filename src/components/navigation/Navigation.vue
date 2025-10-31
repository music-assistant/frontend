<template>
  <nav class="sidebar" :class="{ collapsed }">
    <div class="sidebar-header" @click="router.push({ name: 'home' })">
      <img
        src="@/assets/icon.svg"
        alt="Music Assistant"
        class="sidebar-header-logo"
        @click="toggleCollapsed"
      />
      <div v-if="!collapsed" class="sidebar-header-title">Music Assistant</div>
    </div>
    <v-list class="sidebar-list">
      <v-list-item
        v-for="menuItem of menuItems"
        :key="menuItem.label"
        slim
        nav
        class="menuButton"
        :to="menuItem.path"
      >
        <template v-if="!collapsed" #prepend>
          <v-icon :icon="menuItem.icon" size="24px" />
        </template>
        <v-icon v-if="collapsed" :icon="menuItem.icon" size="24px" />
        <v-list-item-title v-if="!collapsed" v-text="$t(menuItem.label)" />
      </v-list-item>
    </v-list>
    <div :class="!collapsed ? 'ml-auto' : 'd-flex justify-center'">
      <v-btn
        :icon="collapsed ? 'mdi-dock-left' : 'mdi-dock-right'"
        class="cursor-pointer mt-1"
        variant="plain"
        @click="toggleCollapsed"
      />
    </div>
  </nav>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { getMenuItems } from "./utils/getMenuItems";

const router = useRouter();
const menuItems = getMenuItems();

const storedCollapsed = localStorage.getItem("frontend.settings.collapsed");
const collapsed = ref(storedCollapsed === "true");

const toggleCollapsed = () => {
  collapsed.value = !collapsed.value;
  localStorage.setItem(
    "frontend.settings.collapsed",
    collapsed.value.toString(),
  );
};
</script>

<style scoped>
.menuButton {
  margin: 3px 10px;
  padding: 0px 15px;
  border-radius: 15px;
}

.v-list-item-title {
  font-size: medium;
  font-weight: bold;
}

.v-list-item--density-default.v-list-item--one-line {
  min-height: 44px;
}

.v-icon {
  opacity: 1;
}

.v-btn--active {
  color: rgb(var(--v-theme-primary));
}

.v-slide-group-item--active {
  opacity: 100%;
}
</style>

<style scoped>
.sidebar {
  background-color: rgb(var(--v-theme-panel));
  width: 290px;
  transition: width 0.3s ease;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.sidebar.collapsed {
  width: 68px;
}

.sidebar-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 15px 22px 0 22px;
  transition: all 0.3s ease;
  position: relative;
  cursor: pointer;
}

.sidebar.collapsed .sidebar-header {
  margin: 15px 10px 0 10px;
  justify-content: center;
}

.sidebar-header-logo {
  width: 30px;
  height: 30px;
  border-radius: 6px;
  flex-shrink: 0;
}

.sidebar-header-title {
  font-size: 1.2rem;
  font-weight: bold;
  margin: 3px 0 0 10px;
  white-space: nowrap;
  overflow: hidden;
  transition: opacity 0.2s ease;
}

.sidebar-list {
  background-color: rgb(var(--v-theme-panel));
  list-style: none;
  padding: 0;
  margin: 0;
  margin-top: 20px;
  flex: 1;
  padding-bottom: 30px;
}

.sidebar.collapsed .menuButton {
  padding: 0;
  margin: 3px 10px;
}

.sidebar.collapsed .menuButton :deep(.v-list-item__content) {
  align-self: center;
  grid-area: content-start;
  overflow: hidden;
  min-width: 40px;
  display: flex;
  justify-content: center;
}

.sidebar-list li {
  padding: 12px 16px;
}
.sidebar-list li a {
  color: inherit;
  text-decoration: none;
  display: block;
  border-radius: 4px;
  transition: background 0.2s;
}
.sidebar-list li a:hover {
  background: #333;
}
</style>
