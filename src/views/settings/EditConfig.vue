<template>
  <section>
    <v-form v-model="valid" v-if="conf" ref="form">
      <!-- name field -->
      <v-text-field
        v-if="'name' in conf"
        v-model="conf.name"
        :placeholder="modelValue?.name"
        :label="
          'player_id' in conf
            ? $t('settings.player_name')
            : $t('settings.provider_name')
        "
        variant="outlined"
        clearable
      ></v-text-field>

      <!-- enable field -->
      <v-switch
        v-if="'enabled' in conf"
        v-model="conf.enabled"
        :label="
          'player_id' in conf
            ? $t('settings.enable_player')
            : $t('settings.enable_provider')
        "
        color="primary"
      ></v-switch>
      <v-divider />
      <!-- config rows for all config entries -->
      <v-expansion-panels
        v-model="activePanel"
        variant="accordion"
        multiple
        v-if="conf.enabled"
      >
        <!-- 
          we split up the config settings in basic and advanced settings,
          using expansion panels to divide them, where only the advanced one can be expanded/collapsed.
        -->
        <v-expansion-panel v-for="panel of panels" :value="panel">
          <v-expansion-panel-title v-if="panel == 'advanced'"
            ><div class="expansion-panel-text">
              {{ $t("settings.advanced_settings") }}
            </div></v-expansion-panel-title
          >
          <br />
          <v-expansion-panel-text>
            <div
              class="configrow"
              v-for="conf_item_value of Object.values(conf.values).filter(
                (x) => x.advanced == (panel == 'advanced') && !x.hidden
              )"
              :key="conf_item_value.key"
            >
              <div class="configcolumnleft">
                <!-- boolean value: toggle switch -->
                <v-switch
                  v-if="conf_item_value.type == ConfigEntryType.BOOLEAN"
                  v-model="conf_item_value.value"
                  :label="
                    $t(`settings.${conf_item_value.key}`, conf_item_value.label)
                  "
                  color="primary"
                  :disabled="
                    conf_item_value.depends_on != undefined &&
                    !conf.values[conf_item_value.depends_on].value
                  "
                ></v-switch>
                <!-- textbox with single value -->
                <v-text-field
                  v-if="
                    (conf_item_value.type == ConfigEntryType.STRING ||
                      conf_item_value.type == ConfigEntryType.INT ||
                      conf_item_value.type == ConfigEntryType.FLOAT) &&
                    !conf_item_value.options
                  "
                  v-model="conf_item_value.value"
                  :placeholder="conf_item_value.default_value?.toString()"
                  :disabled="
                    conf_item_value.depends_on != undefined &&
                    !conf.values[conf_item_value.depends_on].value
                  "
                  :label="
                    $t(`settings.${conf_item_value.key}`, conf_item_value.label)
                  "
                  :required="conf_item_value.required"
                  :rules="[
                    (v) =>
                      !(!v && conf_item_value.required) ||
                      $t('settings.invalid_input'),
                  ]"
                  variant="outlined"
                  :clearable="!conf_item_value.required"
                ></v-text-field>
                <!-- password value -->
                <v-text-field
                  v-if="conf_item_value.type == ConfigEntryType.PASSWORD"
                  v-model="conf_item_value.value"
                  :label="
                    $t(`settings.${conf_item_value.key}`, conf_item_value.label)
                  "
                  :required="conf_item_value.required"
                  :disabled="
                    conf_item_value.depends_on != undefined &&
                    !conf.values[conf_item_value.depends_on].value
                  "
                  :rules="[
                    (v) =>
                      !(!v && conf_item_value.required) ||
                      $t('settings.invalid_input'),
                  ]"
                  type="password"
                  variant="outlined"
                  clearable
                ></v-text-field>
                <!-- value with dropdown -->
                <v-select
                  :chips="conf_item_value.multi_value"
                  :clearable="conf_item_value.multi_value"
                  :multiple="conf_item_value.multi_value"
                  v-if="
                    conf_item_value.options &&
                    conf_item_value.options.length > 0
                  "
                  :items="conf_item_value.options"
                  v-model="conf_item_value.value"
                  :placeholder="conf_item_value.default_value?.toString()"
                  :disabled="
                    conf_item_value.depends_on != undefined &&
                    !conf.values[conf_item_value.depends_on].value
                  "
                  :label="
                    $t(`settings.${conf_item_value.key}`, conf_item_value.label)
                  "
                  :required="conf_item_value.required"
                  :rules="[
                    (v) =>
                      !(!v && conf_item_value.required) ||
                      $t('settings.invalid_input'),
                  ]"
                  variant="outlined"
                ></v-select>
              </div>
              <div class="configcolumnright">
                <!-- right side of control: help icon with description-->
                <v-tooltip
                  location="start"
                  origin="end center"
                  :close-on-back="true"
                  :open-on-click="true"
                  :open-on-hover="true"
                >
                  <template #activator="{ props: tooltip }">
                    <v-icon
                      class="helpicon"
                      v-bind="tooltip"
                      size="x-large"
                      color="grey-lighten-1"
                      >mdi-help-box</v-icon
                    >
                  </template>
                  <div v-if="conf_item_value.description">
                    {{ conf_item_value.description }}
                  </div>
                  <div v-else>{{ $t("settings.not_loaded") }}</div>
                </v-tooltip>
              </div>
            </div>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
      <br />
      <v-btn block color="primary" @click="onSave">{{
        $t("settings.save")
      }}</v-btn>
    </v-form>
    <br />
    <v-btn block @click="$router.back()">{{ $t("settings.close") }}</v-btn>
  </section>
</template>

<script setup lang="ts">
import { reactive, ref, VNodeRef } from "vue";
import "vue-virtual-scroller/dist/vue-virtual-scroller.css";

import { api, ConnectionState } from "@/plugins/api";
import {
  ConfigEntryType,
  EventMessage,
  EventType,
  PlayerConfig,
  ProviderConfig,
  ProviderManifest,
  ProviderType,
} from "@/plugins/api/interfaces";
import { getProviderIcon } from "@/components/ProviderIcons.vue";
import { computed, onBeforeUnmount, watchEffect } from "vue";
import { store } from "@/plugins/store";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";

export interface Props {
  modelValue?: PlayerConfig | ProviderConfig;
}

const emit = defineEmits<{
  (e: "update:modelValue", value: PlayerConfig | ProviderConfig): void;
}>();

// global refs
const conf = ref<ProviderConfig | PlayerConfig>();
const valid = ref(false);
const form = ref<VNodeRef>();
const activePanel = ref<string>("basic");

// props
const props = defineProps<Props>();

// computed props
const hasAdvanced = computed(() => {
  if (!conf.value) return false;
  return (
    Object.values(conf.value.values).filter((x) => x.advanced && !x.hidden)
      .length > 0
  );
});
const panels = computed(() => {
  if (!hasAdvanced.value) return ["basic"];
  return ["basic", "advanced"];
});

// watchers
watchEffect(async () => {
  conf.value = props.modelValue;
});

// methods
const validate = async function (this: any) {
  const { valid } = await (form.value as any).validate();
  return valid;
};
const onSave = async function (this: any) {
  if ((await validate()) && conf.value) {
    emit("update:modelValue", conf.value);
  }
};
const clickLink = function (url: string) {
  window.open(url, "_blank");
};
</script>

<style>
.configrow {
  display: flex;
  width: 100%;
}

.configcolumnleft {
  flex: 90%;
}
.configcolumnright {
  align-content: flex-end;
  vertical-align: middle;
}
.helpicon {
  margin-top: 10px;
  margin-left: 8px;
}

.v-expansion-panel-title__icon {
  margin-right: -20px;
}

.expansion-panel-text {
  margin-left: -20px;
  font-weight: 500;
  font-size: larger;
}

.listitem-action {
  align-items: right;
  width: 40px;
  display: flex;
}
.listitem-actions {
  align-items: right;
  width: 400px;
  height: 50px;
  display: flex;
  margin-right: -20px;
}
.listitem-thumb {
  padding-left: 0px;
  margin-right: 10px;
  margin-left: -15px;
  width: 50px;
  height: 50px;
}
</style>
