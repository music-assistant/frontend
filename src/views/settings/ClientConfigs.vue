<template>
  <!-- client settings -->
  <div style="margin-bottom: 10px">
    <v-toolbar color="transparent" style="height: 55px">
      <template #title>{{ $t('settings.client') }}</template>
    </v-toolbar>
    <Container style="overflow: hidden">
      <v-table style="overflow: hidden">
        <tbody style="overflow: hidden">
          <tr>
            <td>Enable Discord RPC</td>
            <td>
              <v-switch
                v-model="discordRPCEnabled"
                style="height: 56px"
                label="Restart to apply changes"
                @change="discordRpcConfig"
              />
            </td>
          </tr>
          <tr>
            <td>Start squeezelite</td>
            <td>
              <v-switch
                v-model="squeezeliteEnabled"
                style="height: 56px"
                label="Restart to apply changes"
                @change="squeezeliteConfig"
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
                rounded="lg"
                @update:model-value="themeSettingConfig"
              >
                <v-btn class="text-center my-auto" style="width: 15%; height: 80%" value="system">System</v-btn>
                <v-btn class="text-center my-auto" style="width: 15%; height: 80%" value="light">Light</v-btn>
                <v-btn class="text-center my-auto" style="width: 15%; height: 80%" value="dark">Dark</v-btn>
              </v-btn-toggle>
            </td>
          </tr>
          <tr>
            <td>Server IP / Hostname (Restart to apply)</td>
            <td>
              <v-text-field
                v-model="ip"
                variant="outlined"
                label="IP / Hostname"
                placeholder="homeassistant.local"
                @change="ipConfig"
              />
            </td>
          </tr>
          <tr>
            <td>Server Port (Restart to apply)</td>
            <td>
              <v-text-field
                v-model="port"
                variant="outlined"
                type="number"
                label="Port"
                placeholder="8095"
                @change="portConfig"
              />
            </td>
          </tr>
          <tr>
            <td>Check for updates</td>
            <td>
              <v-btn @click="checkForUpdates">Check for updates</v-btn>
            </td>
          </tr>
          <tr>
            <td>App Version</td>
            <td>
              {{ version }}
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

// global refs
const router = useRouter();
// local refs
const discordRPCEnabled = ref(false);
const squeezeliteEnabled = ref(false);
const port = ref(8095);
const ip = ref('homeassistant.local');
const themeSetting = ref('light');
const version = ref('loading...');

const theme = useTheme();

// methods
const discordRpcConfig = () => {
  localStorage.setItem('discordRPCEnabled', discordRPCEnabled.value.toString());
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
  squeezeliteEnabled.value = localStorage.getItem('squeezeliteEnabled') === 'true' || false;
  themeSetting.value = localStorage.getItem('themeSetting') || 'system';
  ip.value = localStorage.getItem('mass_ip') || 'homeassistant.local';
  port.value = Number(localStorage.getItem('mass_port')) || 8095;
  version.value = await getVersion();
  themeSettingConfig();
});
</script>
