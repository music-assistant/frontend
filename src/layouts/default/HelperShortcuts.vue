<template>
  <!-- players side menu -->
  <v-navigation-drawer
    v-model="store.showKeyHelper"
    location="middle"
    app
    clipped
    temporary
    touchless
    width="290"
    style="z-index: 9999"
  >
    <!-- heading with Players as title-->
    <v-card-title class="title">
      <b>Shortcuts</b>
    </v-card-title>

    <!-- collapsible keys rows-->
    <v-row>
      <v-col class="d-flex flex-column align-center" cols="4">
        <v-list lines="one">
          <v-list-item
            v-for="shortcut in listShortcutsColA"
            :key="shortcut.key"
            :title="'Key: ' + shortcut.key"
            :subtitle="shortcut.description"
          ></v-list-item>
        </v-list>
      </v-col>

      <v-col class="d-flex flex-column align-center" cols="4">
        <v-list lines="one">
          <v-list-item
            v-for="shortcut in listShortcutsColB"
            :key="shortcut.key"
            :title="'Key: ' + shortcut.key"
            :subtitle="shortcut.description"
          ></v-list-item>
        </v-list>
      </v-col>
      <v-col class="d-flex flex-column align-center" cols="4">
        <v-list lines="one">
          <v-list-item
            v-for="shortcut in listShortcutsColC"
            :key="shortcut.key"
            :title="'Key: ' + shortcut.key"
            :subtitle="shortcut.description"
          ></v-list-item>
        </v-list>
      </v-col>

    </v-row>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, onMounted, ref, watch } from 'vue';
import { store } from '@/plugins/store';

const panelItem = ref<number | undefined>(undefined);


const listShortcutsColA = [
  {"key": "CTRL + ALT + S", "description": "Enable/Disable shuffle"},
  {"key": "CTRL + ALT + R", "description": "Enable/Disable repea,t"},
  {"key": "CTRL + ALT + 1", "description": "Go home"},
  {"key": "CTRL + ALT + 2", "description": "Go search"},
  {"key": "CTRL + ALT + 3", "description": "Go Artists"},
  {"key": "CTRL + ALT + 4", "description": "Go Albums"},
];
const listShortcutsColB = [
  {"key": "CTRL + ALT + 4", "description": "Go Albums"},
  {"key": "CTRL + ALT + 5", "description": "Go Tracks"},
  {"key": "CTRL + ALT + 6", "description": "Go Playlists"},
  {"key": "CTRL + ALT + 7", "description": "Go Radios"},
  {"key": "CTRL + ALT + 8", "description": "Go Browse"},
];

const listShortcutsColC = [
  {"key": "CTRL + SHIFT + S", "description": "Go Settings"},
  {"key": "CTRL + ARROW LEFT", "description": "Prevoius track"},
  {"key": "CTRL + ARROW RIGHT", "description": "Next track"},
  {"key": "SPACE", "description": "Play/Pause"}
]

const shadowRoot = ref<ShadowRoot>();
onMounted(() => {
  shadowRoot.value = getCurrentInstance()?.vnode?.el?.getRootNode();
});


//watchers
watch(
  () => store.showKeyHelper,
  (newVal) => {
    if (!newVal) {
      panelItem.value = undefined;
    }
  },
);


</script>

<style scoped>
.title {
  font-family: 'JetBrains Mono Medium';
  font-size: x-large;
  opacity: 0.7;
  margin-top: 10px;
  margin-bottom: 10px;
}
</style>
