<template>
  <section>
    <!-- PlayerQueue settings related content menu -->
    <div>
      <div
        style="
          margin-left: 10px;
          margin-right: 10px;
          margin-top: 10px;
          margin-bottom: 10px;
        "
      >
        <v-card>
          <!-- base settings -->
          <v-list>
            <v-list-subheader>{{ t('basic_settings') }}</v-list-subheader>

            <!-- shuffle -->
            <v-list-item
              :title="$t('shuffle')"
              :subtitle="$t('shuffle_description')"
            >
              <template #append>
                <v-select
                  :style="`min-width: 100px; max-width: ${calMaxWidth(
                    $vuetify.display.width
                  )}px;`"
                  :model-value="
                    activePlayerQueue?.settings.shuffle_enabled.toString()
                  "
                  :items="[
                    { title: $t('on'), value: 'true' },
                    { title: $t('off'), value: 'false' },
                  ]"
                  hide-details
                  variant="underlined"
                  @update:model-value="
                    api.playerQueueSettings(activePlayerQueue?.queue_id, {
                      shuffle_enabled: parseBool($event),
                    })
                  "
                />
              </template>
            </v-list-item>

            <!-- repeat -->
            <v-list-item
              :title="$t('repeat')"
              :subtitle="$t('repeat_description')"
            >
              <template #append>
                <v-select
                  :style="`min-width: 100px; max-width: ${calMaxWidth(
                    $vuetify.display.width
                  )}px;`"
                  :model-value="activePlayerQueue?.settings.repeat_mode"
                  :items="[
                    {
                      title: $t('off'),
                      value: RepeatMode.OFF,
                    },
                    {
                      title: $t('repeatmode.one'),
                      value: RepeatMode.ONE,
                    },
                    {
                      title: $t('repeatmode.all'),
                      value: RepeatMode.ALL,
                    },
                  ]"
                  hide-details
                  variant="underlined"
                  @update:model-value="
                    api.playerQueueSettings(activePlayerQueue?.queue_id, {
                      repeat_mode: $event,
                    })
                  "
                />
              </template>
            </v-list-item>

            <!-- crossfade mode -->
            <v-list-item
              :title="$t('crossfade')"
              :subtitle="$t('crossfade_description')"
            >
              <template #append>
                <v-select
                  :style="`min-width: 100px; max-width: ${calMaxWidth(
                    $vuetify.display.width
                  )}px;`"
                  :model-value="activePlayerQueue?.settings.crossfade_mode"
                  :items="[
                    {
                      title: $t('crossfademode.disabled'),
                      value: CrossFadeMode.DISABLED,
                    },
                    {
                      title: $t('crossfademode.strict'),
                      value: CrossFadeMode.STRICT,
                    },
                    {
                      title: $t('crossfademode.smart'),
                      value: CrossFadeMode.SMART,
                    },
                    {
                      title: $t('crossfademode.always'),
                      value: CrossFadeMode.ALWAYS,
                    },
                  ]"
                  hide-details
                  variant="underlined"
                  @update:model-value="
                    api.playerQueueSettings(activePlayerQueue?.queue_id, {
                      crossfade_mode: $event,
                    })
                  "
                />
              </template>
            </v-list-item>

            <!-- crossfade duration -->
            <v-list-item
              :title="$t('crossfade_duration')"
              :subtitle="$t('crossfade_duration_description')"
              :disabled="
                activePlayerQueue?.settings.crossfade_mode ==
                CrossFadeMode.DISABLED
              "
            >
              <v-slider
                :min="1"
                :max="10"
                :step="1"
                :track-size="2"
                :thumb-size="10"
                :hide-details="true"
                class="list-item-subtitle-slider"
                :model-value="activePlayerQueue?.settings.crossfade_duration"
                @update:model-value="
                  api.playerQueueSettings(activePlayerQueue?.queue_id || '', {
                    crossfade_duration: $event,
                  })
                "
              >
                <template #append>
                  <div class="text-caption">
                    {{
                      $t('crossfade_seconds', [
                        activePlayerQueue?.settings.crossfade_duration,
                      ])
                    }}
                  </div>
                </template>
              </v-slider>
            </v-list-item>

            <!-- announce volume increase -->
            <v-list-item
              :title="$t('announce_volume_increase')"
              :subtitle="$t('announce_volume_increase_description')"
              :disabled="
                activePlayerQueue?.settings.crossfade_mode ==
                CrossFadeMode.DISABLED
              "
            >
              <v-slider
                :min="1"
                :max="100"
                :step="1"
                :track-size="2"
                :thumb-size="10"
                :hide-details="true"
                class="list-item-subtitle-slider"
                :style="'padding-bottom: 15px;'"
                :model-value="
                  activePlayerQueue?.settings.announce_volume_increase
                "
                @update:model-value="
                  api.playerQueueSettings(activePlayerQueue?.queue_id || '', {
                    announce_volume_increase: $event,
                  })
                "
              >
                <template #append>
                  <div class="text-caption">
                    {{
                      `${activePlayerQueue?.settings.announce_volume_increase}%`
                    }}
                  </div>
                </template>
              </v-slider>
            </v-list-item>
            <v-divider />

            <!-- advanced/pro settings -->
            <v-list-group value="advanced_settings">
              <template #activator="{ props }">
                <v-list-item
                  v-bind="props"
                  :title="t('advanced_settings')"
                ></v-list-item>
              </template>
              <div style="padding: 8px 16px">
                <!-- volume normalization enabled -->
                <v-list-item
                  :title="$t('volume_normalization')"
                  :subtitle="$t('volume_normalization_description')"
                >
                  <template #append>
                    <v-select
                      :style="`min-width: 100px; max-width: ${calMaxWidth(
                        $vuetify.display.width
                      )}px;`"
                      :model-value="
                        activePlayerQueue?.settings.volume_normalization_enabled.toString()
                      "
                      :items="[
                        { title: $t('on'), value: 'true' },
                        { title: $t('off'), value: 'false' },
                      ]"
                      hide-details
                      variant="underlined"
                      @update:model-value="
                        api.playerQueueSettings(activePlayerQueue?.queue_id, {
                          volume_normalization_enabled: parseBool($event),
                        })
                      "
                    />
                  </template>
                </v-list-item>

                <!-- volume normalization target -->
                <v-list-item
                  :title="$t('volume_normalization_target')"
                  :subtitle="$t('volume_normalization_target_description')"
                  :disabled="
                    !activePlayerQueue?.settings.volume_normalization_enabled
                  "
                >
                  <v-slider
                    :min="-40"
                    :max="0"
                    :step="0.5"
                    :track-size="2"
                    :thumb-size="10"
                    :hide-details="true"
                    class="list-item-subtitle-slider"
                    :model-value="
                      activePlayerQueue?.settings.volume_normalization_target
                    "
                    @update:model-value="
                      api.playerQueueSettings(activePlayerQueue?.queue_id, {
                        volume_normalization_target: $event,
                      })
                    "
                  >
                    <template #append>
                      <div class="text-caption">
                        {{
                          $t('volume_normalization_lufs', [
                            activePlayerQueue?.settings
                              .volume_normalization_target,
                          ])
                        }}
                      </div>
                    </template>
                  </v-slider>
                </v-list-item>

                <!-- stream type -->
                <v-list-item
                  :title="$t('codecs')"
                  :subtitle="$t('stream_type')"
                >
                  <template #append>
                    <v-select
                      :style="`min-width: 100px; max-width: ${calMaxWidth(
                        $vuetify.display.width
                      )}px;`"
                      :model-value="activePlayerQueue?.settings.stream_type"
                      :items="['mp3', 'flac', 'wav', 'aac']"
                      hide-details
                      variant="underlined"
                      @update:model-value="
                        api.playerQueueSettings(activePlayerQueue?.queue_id, {
                          stream_type: $event,
                        })
                      "
                    />
                  </template>
                </v-list-item>

                <!-- max sample rate -->
                <v-list-item
                  :title="$t('max_sample_rate')"
                  :subtitle="$t('max_sample_rate_description')"
                >
                  <template #append>
                    <v-select
                      :style="`min-width: 100px; max-width: ${calMaxWidth(
                        $vuetify.display.width
                      )}px;`"
                      :model-value="activePlayerQueue?.settings.max_sample_rate"
                      :items="[
                        '44100',
                        '48000',
                        '88200',
                        '96000',
                        '176000',
                        '192000',
                        '352000',
                        '384000',
                      ]"
                      hide-details
                      variant="underlined"
                      @update:model-value="
                        api.playerQueueSettings(activePlayerQueue?.queue_id, {
                          max_sample_rate: $event,
                        })
                      "
                    />
                  </template>
                </v-list-item>

                <!-- metadata mode -->
                <v-list-item
                  :title="$t('metadata_mode.title')"
                  :subtitle="$t('metadata_mode_description')"
                >
                  <template #append>
                    <v-select
                      :style="`min-width: 100px; max-width: ${calMaxWidth(
                        $vuetify.display.width
                      )}px;`"
                      :model-value="activePlayerQueue?.settings.metadata_mode"
                      :items="[
                        {
                          title: $t('metadata_mode.disabled'),
                          value: 'disabled',
                        },
                        {
                          title: $t('metadata_mode.default'),
                          value: 'default',
                        },
                        {
                          title: $t('metadata_mode.legacy'),
                          value: 'legacy',
                        },
                      ]"
                      hide-details
                      variant="underlined"
                      @update:model-value="
                        api.playerQueueSettings(activePlayerQueue?.queue_id, {
                          metadata_mode: $event,
                        })
                      "
                    />
                  </template>
                </v-list-item>

                <v-list-item
                  :title="$t('background_jobs')"
                  :subtitle="$t('background_jobs_description')"
                >
                  <template #append>
                    <v-switch
                      v-model="store.showBackgroundJobs"
                      hide-details
                      color="accent"
                      @update:model-value="store.showBackgroundJobs = $event"
                    ></v-switch>
                  </template>
                </v-list-item>

                <!-- sync mode -->
                <v-list-item
                  :title="$t('sync_mode')"
                  :subtitle="$t('sync_mode_description')"
                >
                  <template #append>
                    <v-select
                      :style="`min-width: 100px; max-width: ${calMaxWidth(
                        $vuetify.display.width
                      )}px;`"
                      :model-value="$t('off')"
                      :items="[
                        {
                          title: $t('off'),
                          value: null,
                        },
                        {
                          title: $t('sync'),
                          value: 'false',
                        },
                        {
                          title: $t('sync_full'),
                          value: 'true',
                        },
                      ]"
                      hide-details
                      variant="underlined"
                      @update:model-value="
                        $event != null
                          ? api.startSync(undefined, undefined, $event)
                          : undefined
                      "
                    />
                  </template>
                </v-list-item>
              </div>
            </v-list-group>
          </v-list>
        </v-card>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue';
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css';
import api, { RepeatMode, CrossFadeMode } from '../plugins/api';
import { store } from '../plugins/store';
import { parseBool } from '../utils';
import { useI18n } from 'vue-i18n';

// global refs
const { t } = useI18n();

// local refs
store.topBarTitle = t('settings');
onMounted(() => {
  store.showTabsNav = false;
});

onBeforeUnmount(() => {
  store.showTabsNav = true;
});

const calMaxWidth = function (DisplayWidth: number) {
  return DisplayWidth - 310;
};

// computed properties
const activePlayerQueue = computed(() => {
  if (store.selectedPlayer) {
    return api.queues[store.selectedPlayer.active_queue];
  }
  return undefined;
});
</script>
