<template>
  <v-app>
    <!-- override background color set in iframe by HASS -->
    <div
      style="
        position: fixed;
        height: 100%;
        width: 100%;
        background: rgb(var(--primary-background-color));
      "
    />
    <player-select />
    <TopBar />
    <v-main v-if="store.apiInitialized" id="cont">
      <v-container fluid style="padding: 0">
        <router-view v-slot="{ Component }" app>
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
        <!-- white space to reserve space for footer -->
        <div style="height: 150px" />
      </v-container>
    </v-main>
    <v-footer
      bottom
      fixed
      class="d-flex flex-column"
      :elevation="6"
      style="
        width: 100%;
        box-shadow: var(
          --ha-card-box-shadow,
          0px 2px -1px 1px rgba(0, 0, 0, 0.2),
          0px 1px 0px 1px rgba(0, 0, 0, 0.14),
          0px 1px 0px 3px rgba(0, 0, 0, 0.12)
        ) !important;
      "
      app
    >
      <player-o-s-d />
    </v-footer>
    <ReloadPrompt v-if="store.isInStandaloneMode" />
  </v-app>
</template>

<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-unused-vars,vue/no-setup-props-destructure */
import { ref } from 'vue';
import { api } from './plugins/api';
import { store } from './plugins/store';
import { isColorDark } from './utils';
import { useTheme } from 'vuetify';
import TopBar from './components/TopBar.vue';
import PlayerOSD from './components/PlayerOSD.vue';
import PlayerSelect from './components/PlayerSelect.vue';
import ReloadPrompt from './components/ReloadPrompt.vue';
import 'vuetify/styles';
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css';
import type { HassPanelData, HassData } from './main';
import { useI18n } from 'vue-i18n';

const { locale } = useI18n({ useScope: 'global' });

interface HassPropEvent extends Event {
  detail: HassData;
}
interface HassPanelPropEvent extends Event {
  detail: HassPanelData;
}

document.addEventListener('forward-hass-prop', function (e) {
  const hass = (e as HassPropEvent).detail;
  if (!hass) return;
  if (!store.apiInitialized) {
    api.initialize(hass.connection);
    locale.value = hass.selectedLanguage;
  }
  store.alwaysShowMenuButton = hass.dockedSidebar == 'always_hidden';
  setTheme(hass);
});

document.addEventListener('forward-panel-prop', function (e) {
  store.defaultTopBarTitle = (e as HassPanelPropEvent).detail.config.title;
});

// set theme colors based on HA theme
// TODO: we can set the entire vuetify theme based on HA theme
const theme = useTheme();
const setTheme = async function (hassData: HassData) {
  // determine if dark theme active
  const curTheme = hassData.themes?.theme || 'default';
  const darkMode = hassData?.themes?.darkMode || false;
  store.darkTheme = darkMode;

  if (curTheme == 'default') {
    // default theme
    store.primaryColor = hassData.selectedTheme?.primaryColor || '#03A9F4';
    store.topBarColor = '#101e24';
    store.topBarTextColor = '#ffffff';
    store.topBarColor = darkMode ? '#101e24' : store.primaryColor;
  } else {
    // custom theme
    const customTheme = hassData.themes?.themes[hassData.themes.theme];
    let themeCurMode;

    if (customTheme && customTheme?.modes) {
      themeCurMode = customTheme?.modes[darkMode ? 'dark' : 'light'];
    } else {
      themeCurMode = customTheme;
    }
    if (themeCurMode && 'primary-color' in themeCurMode)
      store.primaryColor = themeCurMode['primary-color'];
    if (themeCurMode && 'primary-text-color' in themeCurMode)
      store.primaryTextColor = themeCurMode['primary-text-color'];
    if (themeCurMode && 'primary-background-color' in themeCurMode)
      store.primaryBackgroundColor = themeCurMode['primary-background-color'];
    if (themeCurMode && 'app-header-background-color' in themeCurMode)
      store.topBarColor = themeCurMode['app-header-background-color'];
    if (themeCurMode && 'app-header-text-color' in themeCurMode)
      store.topBarTextColor = themeCurMode['app-header-text-color'];
  }
  store.topBarHeight = theme['header-height'] || 55;

  theme.name.value = darkMode ? 'dark' : 'light';
};

setTimeout(() => {
  if (!store.apiInitialized) {
    console.log('Activating stand-alone mode...');
    store.isInStandaloneMode = true;
    api.initialize();
  }
}, 1000);
</script>

<style>
a {
  cursor: pointer;
}
.vertical-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.right {
  float: right;
}

.left {
  float: left;
}

div.v-navigation-drawer__scrim {
  opacity: 0.8;
  background: grey;
}

.volumerow {
  height: 60px;
  padding-top: 5px;
  padding-bottom: 0px;
}

.volumerow .v-slider .v-slider__container {
  margin-left: 57px;
  margin-right: 15px;
  margin-top: -10px;
}

.slider .div.v-input__append {
  padding-top: 0px;
  margin-top: -10px;
}

div.v-slide-group__next {
  margin-top: 15px;
}

div.v-slide-group__prev {
  margin-top: 15px;
}

.v-tabs {
  padding-right: 45px;
  padding-left: 45px;
}

.hiresicon {
  position: absolute;
  margin-left: 5px;
  margin-top: -20px;
  height: 30px;
  border-radius: 5px;
}

.padded-overlay .v-overlay__content {
  padding: 50px;
}
.v-overlay__scrim {
  opacity: 65%;
}

.listitem-actions {
  display: flex;
  justify-content: end;
  width: auto;
  height: 50px;
  vertical-align: middle;
  align-items: center;
  padding: 0px;
  padding-right: 0px;
}
.listitem-action {
  padding-left: 5px;
}
.listitem-thumb {
  padding-left: 0px;
  margin-right: 10px;
  margin-left: -15px;
  margin-top: 2px;
  width: 50px;
  height: 50px;
}
.v-card {
  box-shadow: none;
  border-width: var(--ha-card-border-width, 1px);
  border-style: solid;
  border-color: var(--ha-card-border-color, var(--divider-color, #e0e0e0));
}
.text-caption {
  z-index: 3;
}
.v-list-item-subtitle {
  font-size: 0.6875rem;
}
.v-list-item-title {
  font-size: 0.875rem;
}
.v-footer {
  padding: 10px 10px;
}
.line-clamp-1 {
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}
.line-clamp-2 {
  white-space: pre-line;
  overflow: hidden;
  line-height: 1.5em;
  height: 3em;
  word-wrap: break-word;
  box-sizing: border-box;
  display: -webkit-box;
  -webkit-line-clamp: 2;
}

.citl {
  position: relative;
  min-height: 14px;
}

.citl > div {
  position: absolute;
}

.citl > div > div {
  white-space: nowrap;
}
</style>
