<template>
  <v-container>
    <v-card>
      <v-list>
        <v-list-item
          v-for="item in coreConfigs.sort((a, b) => a.manifest.name!.localeCompare(b.manifest.name!))"
          :key="item.domain"
          v-hold="
            () => {
              editCoreConfig(item.domain);
            }
          "
          class="list-item-main"
          link
          @click="editCoreConfig(item.domain)"
        >
          <template #prepend>
            <provider-icon
              :manifest="item.manifest"
              :size="'40px'"
              class="listitem-media-thumb"
              style="margin-left: 10px"
            />
          </template>

          <!-- title -->
          <template #title>
            <div class="line-clamp-1">{{ item.manifest.name }}</div>
          </template>

          <!-- subtitle -->
          <template #subtitle
            ><div class="line-clamp-1">{{ item.manifest.description }}</div>
          </template>
          <!-- append -->
          <template #append>
            <div class="list-actions">
              <div v-if="item.last_error">
                <v-tooltip location="top end" origin="end center">
                  <template #activator="{ props: tooltip }">
                    <v-btn class="buttonicon" variant="plain" :ripple="false" :icon="true" v-bind="tooltip">
                      <v-icon v-bind="tooltip" color="red"> mdi-alert-circle </v-icon>
                    </v-btn>
                  </template>
                  <span>{{ item.last_error }}</span>
                </v-tooltip>
              </div>

              <!-- contextmenu-->
              <v-menu location="bottom end">
                <template #activator="{ props }">
                  <v-btn class="buttonicon" variant="plain" :ripple="false" :icon="true" v-bind="props">
                    <v-icon icon="mdi-dots-vertical" />
                  </v-btn>
                </template>

                <v-list>
                  <v-list-item
                    class="list-item-main"
                    :title="$t('settings.configure')"
                    prepend-icon="mdi-cog"
                    @click="editCoreConfig(item.domain)"
                  />
                  <v-list-item
                    v-if="item.manifest.documentation"
                    class="list-item-main"
                    :title="$t('settings.documentation')"
                    prepend-icon="mdi-bookshelf"
                    :href="item.manifest.documentation"
                    target="_blank"
                  />
                </v-list>
              </v-menu>
            </div>
          </template>
        </v-list-item>
      </v-list>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { api } from '@/plugins/api';
import { EventType, CoreConfig } from '@/plugins/api/interfaces';
import ProviderIcon from '@/components/ProviderIcon.vue';
import { useRouter } from 'vue-router';

// global refs
const router = useRouter();

// local refs
const coreConfigs = ref<CoreConfig[]>([]);
console.log(coreConfigs);

// methods
const loadItems = async function () {
  coreConfigs.value = await api.getCoreConfigs();
};

const editCoreConfig = function (domain: string) {
  router.push(`/settings/editcore/${domain}`);
};

onMounted(async () => {
  coreConfigs.value = await api.getCoreConfigs();
});
</script>

<style>
.list-actions {
  display: inline-flex;
  width: auto;
  vertical-align: middle;
  align-items: center;
  padding: 0px;
}
</style>
