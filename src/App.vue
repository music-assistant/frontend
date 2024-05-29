<template>
  <router-view />
</template>

<script setup lang="ts">
import { ConnectionState, api } from '@/plugins/api';
import { onMounted } from 'vue';
import { useTheme } from 'vuetify';
import { store } from '@/plugins/store';
import { i18n } from '@/plugins/i18n';
import router from './plugins/router';
import { sleep } from './helpers/utils';
const theme = useTheme();

const setTheme = function () {
  const themePref = localStorage.getItem('frontend.settings.theme') || 'auto';
  if (themePref == 'dark') {
    // forced dark mode
    theme.global.name.value = 'dark';
  } else if (themePref == 'light') {
    // forced light mode
    theme.global.name.value = 'light';
  } else if (
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    // dark mode is enabled in browser
    theme.global.name.value = 'dark';
  } else {
    // light mode is enabled in browser
    theme.global.name.value = 'light';
  }
};

onMounted(() => {
  // @ts-ignore
  store.isInStandaloneMode = window.navigator.standalone || false;

  // set navigation menu style
  store.navigationMenuStyle =
    localStorage.getItem('frontend.settings.menu_style') || 'horizontal';

  // cache some settings in the store
  store.allowExternalImageRetrieval =
    (localStorage.getItem('frontend.settings.artwork_pref') || 'online') ==
    'online';

  const langPref = localStorage.getItem('frontend.settings.language') || 'auto';
  if (langPref !== 'auto') {
    i18n.global.locale.value = langPref;
  }

  // set color theme (and listen for color scheme changes from browser)
  setTheme();
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', setTheme);

  const handleKeyDown = (e) => {
   // console.log(e);
      const key = e.code;
      const ctrlPressed = e.ctrlKey;
      const altPressed = e.altKey;
      const shiftPressed = e.shiftKey;
      let keyDetected = true;

      if (ctrlPressed) {
          if (altPressed) {
              if (key === 'KeyS') api.queueCommandShuffle(
                                    store.activePlayerQueue?.queue_id || '',
                                    store.activePlayerQueue?.shuffle_enabled ? false : true,
                                  )
              else if (key === 'KeyR') api.queueCommandRepeat(
                                          store.activePlayerQueue?.queue_id || '',
                                          getValueFromSources(null, [
                                            [
                                              store.activePlayerQueue?.repeat_mode == RepeatMode.OFF,
                                              RepeatMode.ONE,
                                            ],
                                            [
                                              store.activePlayerQueue?.repeat_mode == RepeatMode.ALL,
                                              RepeatMode.OFF,
                                            ],
                                            [
                                              store.activePlayerQueue?.repeat_mode == RepeatMode.ONE,
                                              RepeatMode.ALL,
                                            ],
                                          ]),
                                        )
                                        else if (key === 'Digit1') router.push('/home');
              else if (key === 'Digit2') router.push('/search');
              else if (key === 'Digit3') router.push('/artists');
              else if (key === 'Digit4')  router.push('/albums');
              else if (key === 'Digit5') router.push('/tracks');
              else if (key === 'Digit6') router.push('/playlists');
              else if (key === 'Digit7')router.push('/radios');
              else if (key === 'Digit8') router.push('/browse');
              else { keyDetected = false; }
          } else {
            if (shiftPressed) {
               
               if (key === 'KeyS') router.push('/settings');
               
               else keyDetected = false; 
            } else {
              // else if (key === 'KeyR') // player side
              if (key === 'ArrowLeft') api.queueCommandPrevious(store.activePlayerQueue!.queue_id);
              else if (key === 'ArrowRight')  api.queueCommandNext(store.activePlayerQueue!.queue_id);
              else keyDetected = false; 
            }
            
          }
      } else {
        if (shiftPressed) {
          if (key === 'Slash') store.showKeyHelper = (store.showKeyHelper ? false : true);
          else keyDetected = false;
        } else {
          if (key === 'Space') api.queueCommandPlayPause(store.activePlayerQueue!.queue_id);
          else keyDetected = false;
        }
      }
      console.log(store.showKeyHelper);
      if (keyDetected)
        e.preventDefault();
  }

  window.addEventListener('keydown', handleKeyDown, true)
  // Initialize API Connection
  // TODO: retrieve serveraddress through discovery and/or user settings ?
  let serverAddress = '';
  if (process.env.NODE_ENV === 'development') {
    serverAddress = localStorage.getItem('mass_debug_address') || '';
    if (!serverAddress) {
      serverAddress =
        prompt(
          'Enter location of the Music Assistant server',
          window.location.origin.replace('3000', '8095'),
        ) || '';
      localStorage.setItem('mass_debug_address', serverAddress);
    }
  } else {
    const loc = window.location;
    serverAddress = loc.origin + loc.pathname;
  }
  api.initialize(serverAddress);

  // very rude way to redirect the user to the settings page if this is a fresh install
  sleep(1000).then(() => {
    if (
      api.state.value === ConnectionState.CONNECTED &&
      !api.setUpCompleted.value
    ) {
      router.push('/settings');
    }
  });
});
</script>
