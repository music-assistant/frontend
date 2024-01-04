<template>
  <!-- client settings -->
  <div>
    <v-toolbar color="transparent">
      <template #title>{{ $t('settings.client') }} {{ $t('settings') }}</template>
    </v-toolbar>
    <Container>
      <v-table>
        <tbody>
          <!-- <tr>
            <td>
              Close to tray
              <v-tooltip text="Wether or not to close the app to tray instead of fully exiting.">
                <template #activator="{ props }">
                  <v-icon
                    style="margin-left: 3px; margin-bottom: 1px"
                    size="20"
                    icon="mdi-information-outline"
                    v-bind="props"
                  />
                </template>
              </v-tooltip>
            </td>
            <td>
              <v-switch
                v-model="closeToTrayEnabled"
                style="height: 56px"
                label="Relaunch to apply"
                @change="closeToTrayConfig"
              />
            </td>
          </tr> -->
          <tr>
            <td>
              Launch Squeezelite
              <v-tooltip text="Wether or not to start a music player on this machine.">
                <template #activator="{ props }">
                  <v-icon
                    style="margin-left: 3px; margin-bottom: 1px"
                    size="20"
                    icon="mdi-information-outline"
                    v-bind="props"
                  />
                </template>
              </v-tooltip>
            </td>
            <td>
              <v-switch
                v-model="squeezeliteEnabled"
                style="height: 56px"
                label="Relaunch to apply"
                @change="squeezeliteConfig"
              />
            </td>
          </tr>
          <tr>
            <td>
              Audio output device (Relaunch to apply)
              <v-tooltip text="The output device squeezelite should play to.">
                <template #activator="{ props }">
                  <v-icon
                    style="margin-left: 3px; margin-bottom: 1px"
                    size="20"
                    icon="mdi-information-outline"
                    v-bind="props"
                  />
                </template>
              </v-tooltip>
            </td>
            <td>
              <v-select
                v-model="outputDevice"
                :items="availableOutputDevices"
                label="Output device"
                style="margin-top: 15px; height: 70px"
                variant="outlined"
                @change="outputDevice"
              />
            </td>
          </tr>
          <tr>
            <td>
              Discord RPC
              <v-tooltip text="Wether or not to show music activity on Discord.">
                <template #activator="{ props }">
                  <v-icon
                    style="margin-left: 3px; margin-bottom: 1px"
                    size="20"
                    icon="mdi-information-outline"
                    v-bind="props"
                  />
                </template>
              </v-tooltip>
            </td>
            <td>
              <v-switch
                v-model="discordRPCEnabled"
                style="height: 56px"
                label="Relaunch to apply"
                @change="discordRpcConfig"
              />
            </td>
          </tr>
          <tr>
            <td>Theme settings</td>
            <td>
              <v-btn-toggle
                v-model="themeSetting"
                style="width: 100%"
                mandatory
                variant="outlined"
                divided
                @update:model-value="themeSettingConfig"
              >
                <v-btn class="text-center my-auto" style="width: 15%; height: 80%" value="system">System</v-btn>
                <v-btn class="text-center my-auto" style="width: 15%; height: 80%" value="light">Light</v-btn>
                <v-btn class="text-center my-auto" style="width: 15%; height: 80%" value="dark">Dark</v-btn>
              </v-btn-toggle>
            </td>
          </tr>
          <tr>
            <td>Check for updates</td>
            <td>
              <v-btn variant="tonal" @click="checkForUpdates">Check for updates</v-btn>
            </td>
          </tr>
          <tr>
            <td>Relaunch Companion</td>
            <td>
              <v-btn variant="tonal" @click.prevent="relaunch">Relaunch Companion App</v-btn>
            </td>
          </tr>
          <tr>
            <td>Companion Version</td>
            <td>v{{ version }}</td>
          </tr>
        </tbody>
      </v-table>
    </Container>
    <v-toolbar color="transparent">
      <template #title>Connection {{ $t('settings') }}</template>
    </v-toolbar>
    <Container>
      <v-table>
        <tbody>
          <tr>
            <td>Server IP / Hostname (Relaunch to apply)</td>
            <td>
              <v-text-field
                v-model="ip"
                style="margin-top: 15px; height: 70px"
                variant="outlined"
                label="IP / Hostname"
                placeholder="homeassistant.local"
                @change="ipConfig"
              />
            </td>
          </tr>
          <tr>
            <td>Server Port (Relaunch to apply)</td>
            <td>
              <v-text-field
                v-model="port"
                style="margin-top: 15px; height: 70px"
                variant="outlined"
                type="number"
                label="Port"
                placeholder="8095"
                @change="portConfig"
              />
            </td>
          </tr>
        </tbody>
      </v-table>
    </Container>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useTheme } from 'vuetify';
import Container from '@/components/mods/Container.vue';
import { useRouter } from 'vue-router';
import { emit } from '@tauri-apps/api/event';
import { getVersion } from '@tauri-apps/api/app';
import { relaunch } from '@tauri-apps/api/process';

// global refs
const router = useRouter();
// local refs
const discordRPCEnabled = ref(false);
const squeezeliteEnabled = ref(true);
const closeToTrayEnabled = ref(true);
const port = ref(8095);
const ip = ref('homeassistant.local');
const themeSetting = ref('light');
const version = ref('Loading...');

const outputDevice = ref('default');
const availableOutputDevices = ref(['default']);

const theme = useTheme();

// methods
const discordRpcConfig = () => {
  localStorage.setItem('discordRPCEnabled', discordRPCEnabled.value.toString());
};

const closeToTrayConfig = () => {
  localStorage.setItem('closeToTrayEnabled', closeToTrayEnabled.value.toString());
};

const squeezeliteConfig = () => {
  localStorage.setItem('squeezeliteEnabled', squeezeliteEnabled.value.toString());
};

const ipConfig = () => {
  localStorage.setItem('mass_ip', ip.value.toString());
};

const portConfig = () => {
  localStorage.setItem('mass_port', port.value.toString());
};

const themeSettingConfig = () => {
  localStorage.setItem('themeSetting', themeSetting.value);
  if (themeSetting.value == 'dark') {
    theme.global.name.value = 'dark';
  } else if (themeSetting.value == 'light') {
    theme.global.name.value = 'light';
  } else {
    theme.global.name.value = localStorage.getItem('systemTheme') || 'light';
  }
};

const checkForUpdates = async () => {
  await emit('tauri://update');
};

onMounted(async () => {
  discordRPCEnabled.value = localStorage.getItem('discordRPCEnabled') === 'true' || false;
  squeezeliteEnabled.value = localStorage.getItem('squeezeliteEnabled') === 'true' || true;
  closeToTrayEnabled.value = localStorage.getItem('closeToTrayEnabled') === 'true' || true;
  themeSetting.value = localStorage.getItem('themeSetting') || 'system';
  ip.value = localStorage.getItem('mass_ip') || 'homeassistant.local';
  port.value = Number(localStorage.getItem('mass_port')) || 8095;
  version.value = await getVersion();
  themeSettingConfig();
});
</script>
