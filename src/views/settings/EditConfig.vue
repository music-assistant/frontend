<template>
  <section>
    <v-form v-model="valid" v-if="conf" ref="form">
      <!-- textbox with single value -->
      <v-text-field
          v-model="conf.name"
          :placeholder="$t('settings.name_desc')"
          :label="$t('settings.name')"
          variant="outlined"
          clearable
        ></v-text-field>
        <v-switch
          v-model="conf.enabled"
          :placeholder="$t('settings.enabled')"
          :label="$t('settings.enabled')"
          color="primary"
        ></v-switch>
      <div
        tile
        v-for="(conf_item_value, conf_item_key) in conf.values"
        :key="conf_item_key"
      >
        <!-- boolean value: toggle switch -->
        <v-switch
          v-if="conf_item_value.type == ConfigEntryType.BOOLEAN"
          v-model="conf_item_value.value"
          :placeholder="conf_item_value.description || conf_item_value.default_value || conf_item_value.label"
          :label="$t(`settings.${conf_item_value.key}`, conf_item_value.label)"
          :required="conf_item_value.required"
          :append-inner-icon="conf_item_value.help_link ? 'mdi-help-circle' : ''"
          @click:append-inner="clickLink(conf_item_value.help_link!)"
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
          :placeholder="conf_item_value.description || conf_item_value.default_value?.toString() || conf_item_value.label"
          :label="$t(`settings.${conf_item_value.key}`, conf_item_value.label)"
          :required="conf_item_value.required"
          :rules="[
            (v) => !(!v && conf_item_value.required) || $t('settings.invalid_input'),
          ]"
          variant="outlined"
          clearable
          :append-inner-icon="conf_item_value.help_link ? 'mdi-help-circle' : ''"
          @click:append-inner="clickLink(conf_item_value.help_link!)"
        ></v-text-field>
        <!-- password value -->
        <v-text-field
          v-if="conf_item_value.type == ConfigEntryType.PASSWORD"
          v-model="conf_item_value.value"
          :label="$t(`settings.${conf_item_value.key}`, conf_item_value.label)"
          :required="conf_item_value.required"
          :placeholder="conf_item_value.description || conf_item_value.label"
          :rules="[
            (v) => !(!v && conf_item_value.required) || $t('settings.invalid_input'),
          ]"
          type="password"
          variant="outlined"
          clearable
          :append-inner-icon="conf_item_value.help_link ? 'mdi-help-circle' : ''"
          @click:append-inner="clickLink(conf_item_value.help_link!)"
        ></v-text-field>
        <!-- value with dropdown -->
        <v-select
          chips
          clearable
          :multiple="conf_item_value.multi_value"
          v-if="conf_item_value.options && conf_item_value.options.length > 0"
          :items="conf_item_value.options"
          v-model="conf_item_value.value"
          :placeholder="conf_item_value.description || conf_item_value.default_value?.toString() || conf_item_value.label"
          :label="$t(`settings.${conf_item_value.key}`, conf_item_value.label)"
          :required="conf_item_value.required"
          :rules="[
            (v) => !(!v && conf_item_value.required) || $t('settings.invalid_input'),
          ]"
          variant="outlined"
          :append-inner-icon="conf_item_value.help_link ? 'mdi-help-circle' : ''"
          @click:append-inner="clickLink(conf_item_value.help_link!)"
        ></v-select>
      </div>
      <br />
      <v-btn block color="primary" @click="onSave">{{
        $t("settings.save")
      }}</v-btn>
      
      
    </v-form>
    <br />
    <v-btn block @click="$router.back()">{{
        $t("settings.close")
      }}</v-btn>
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
  (e: 'update:modelValue', value: PlayerConfig | ProviderConfig): void;
}>();

// global refs
const { t } = useI18n();
const conf = ref<ProviderConfig | PlayerConfig>();
const valid = ref(false);
const form = ref<VNodeRef>();

// props
const props = defineProps<Props>();

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
  if (await validate() && conf.value) {
    emit('update:modelValue', conf.value);
  }
};
const clickLink = function (url: string) {
  window.open(url,'_blank');
};
</script>

<style scoped>
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
