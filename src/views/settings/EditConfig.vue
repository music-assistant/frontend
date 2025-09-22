<template>
  <v-form v-if="entries" ref="form" v-model="valid" :disabled="disabled">
    <!-- config rows for all config entries -->
    <v-expansion-panels v-model="activePanel" variant="accordion" multiple flat>
      <!--
          we split up the config settings in multiple sections,
          using expansion panels to divide them.
        -->
      <v-expansion-panel
        v-for="panel of Array.from(panels).filter(
          (p) => entriesForCategory(p).length > 0,
        )"
        :key="panel"
        :value="panel"
        flat
        accordion
        class="configrowpanel"
      >
        <v-expansion-panel-title>
          <h3>
            {{ $t("settings.category." + panel, panel) }}
          </h3>
        </v-expansion-panel-title>
        <br />
        <v-expansion-panel-text>
          <div
            v-for="conf_entry of entriesForCategory(panel)"
            :key="conf_entry.key"
            class="configrow"
          >
            <div class="configcolumnleft">
              <!-- divider value -->
              <div v-if="conf_entry.type == ConfigEntryType.DIVIDER">
                <br />
                <v-divider />
                <v-label
                  v-if="conf_entry.label"
                  style="
                    margin-left: 8px;
                    margin-top: 10px;
                    margin-bottom: 10px;
                  "
                >
                  <b>{{ conf_entry.label }}</b>
                </v-label>
                <br />
                <br />
              </div>

              <!-- label value -->
              <div v-else-if="conf_entry.type == ConfigEntryType.LABEL">
                <br />
                <v-alert variant="outlined" type="info">
                  {{ $t(`settings.${conf_entry.key}.label`, conf_entry.label) }}
                </v-alert>
                <br />
                <br />
              </div>

              <!-- alert value -->
              <div v-else-if="conf_entry.type == ConfigEntryType.ALERT">
                <br />
                <v-alert density="compact" type="warning">
                  {{ $t(`settings.${conf_entry.key}.label`, conf_entry.label) }}
                </v-alert>
                <br />
                <br />
              </div>

              <!-- action type -->
              <div
                v-else-if="
                  conf_entry.type == ConfigEntryType.ACTION ||
                  (conf_entry.action && !conf_entry.value)
                "
              >
                <br />
                <v-btn
                  class="actionbutton"
                  :disabled="conf_entry.read_only"
                  @click="
                    action(conf_entry.action || conf_entry.key);
                    conf_entry.value = conf_entry.action
                      ? null
                      : conf_entry.key;
                  "
                >
                  {{
                    $t(
                      `settings.${conf_entry.action || conf_entry.key}.label`,
                      conf_entry.action_label || conf_entry.label,
                    )
                  }}
                </v-btn>
              </div>

              <!-- DSP Config Button -->
              <div v-else-if="conf_entry.type == ConfigEntryType.DSP_SETTINGS">
                <br />
                {{
                  conf_entry.value
                    ? $t("settings.dsp_enabled")
                    : $t("settings.dsp_disabled")
                }}
                <v-btn class="actionbutton" @click="openDspConfig">
                  {{ $t("open_dsp_settings") }}
                </v-btn>
              </div>

              <!-- boolean value: toggle switch -->
              <v-switch
                v-else-if="conf_entry.type == ConfigEntryType.BOOLEAN"
                v-model="conf_entry.value"
                :label="
                  $t(`settings.${conf_entry.key}.label`, conf_entry.label)
                "
                color="primary"
                :disabled="conf_entry.read_only"
              />

              <!-- int/float value in range: slider control -->
              <!-- eslint-disable vue/valid-v-model -->
              <v-slider
                v-else-if="
                  (conf_entry.type == ConfigEntryType.INTEGER ||
                    conf_entry.type == ConfigEntryType.FLOAT) &&
                  conf_entry.range &&
                  conf_entry.range.length == 2
                "
                v-model="conf_entry.value as number"
                :disabled="conf_entry.read_only"
                :label="
                  $t(`settings.${conf_entry.key}.label`, conf_entry.label)
                "
                :required="conf_entry.required"
                class="align-center"
                :min="conf_entry.range[0]"
                :max="conf_entry.range[1]"
                :step="conf_entry.type == ConfigEntryType.FLOAT ? 0.5 : 1"
                hide-details
                style="margin-top: 10px; margin-bottom: 25px"
                color="primary"
              >
                <template #append>
                  <v-text-field
                    v-model="conf_entry.value"
                    hide-details
                    single-line
                    density="compact"
                    type="number"
                    style="width: 70px"
                  />
                </template>
              </v-slider>
              <!-- eslint-enable vue/valid-v-model -->

              <!-- password value -->
              <v-text-field
                v-else-if="conf_entry.type == ConfigEntryType.SECURE_STRING"
                v-model="conf_entry.value"
                :label="
                  $t(`settings.${conf_entry.key}.label`, conf_entry.label)
                "
                :required="conf_entry.required"
                :disabled="conf_entry.read_only"
                :rules="[
                  (v) =>
                    !(!v && conf_entry.required) ||
                    $t('settings.invalid_input'),
                ]"
                :type="showPasswordValues ? 'text' : 'password'"
                :append-inner-icon="
                  showPasswordValues
                    ? 'mdi-eye'
                    : typeof conf_entry.value == 'string' &&
                        conf_entry.value.includes(SECURE_STRING_SUBSTITUTE)
                      ? ''
                      : 'mdi-eye-off'
                "
                variant="outlined"
                clearable
                :readonly="!!conf_entry.action"
                @click:append-inner="showPasswordValues = !showPasswordValues"
                @click:clear="conf_entry.value = conf_entry.default_value"
              />

              <!-- value with dropdown -->
              <v-select
                v-else-if="conf_entry.options && conf_entry.options.length > 0"
                v-model="conf_entry.value"
                :chips="conf_entry.multi_value"
                :clearable="true"
                :multiple="conf_entry.multi_value"
                :items="getTranslatedOptions(conf_entry)"
                :disabled="conf_entry.read_only"
                :label="
                  $t(`settings.${conf_entry.key}.label`, conf_entry.label)
                "
                :required="conf_entry.required"
                :rules="[
                  (v) =>
                    !(!v && conf_entry.required) ||
                    $t('settings.invalid_input'),
                ]"
                variant="outlined"
                @click:clear="conf_entry.value = conf_entry.default_value"
              />
              <!-- int value without range -->
              <v-text-field
                v-else-if="
                  conf_entry.type == ConfigEntryType.INTEGER ||
                  conf_entry.type == ConfigEntryType.FLOAT
                "
                v-model="conf_entry.value"
                :placeholder="conf_entry.default_value?.toString()"
                :disabled="conf_entry.read_only"
                :label="
                  $t(`settings.${conf_entry.key}.label`, conf_entry.label)
                "
                :required="conf_entry.required"
                :rules="[
                  (v) =>
                    !(!v && conf_entry.required) ||
                    $t('settings.invalid_input'),
                ]"
                variant="outlined"
                :clearable="!conf_entry.required"
                type="number"
                @click:clear="conf_entry.value = conf_entry.default_value"
              />
              <!-- icon 'picker' -->
              <v-text-field
                v-else-if="conf_entry.type == ConfigEntryType.ICON"
                v-model="conf_entry.value"
                :placeholder="conf_entry.default_value?.toString()"
                clearable
                :disabled="conf_entry.read_only"
                :label="
                  $t(`settings.${conf_entry.key}.label`, conf_entry.label)
                "
                :prepend-inner-icon="conf_entry.value as string"
                variant="outlined"
                @click:clear="conf_entry.value = conf_entry.default_value"
              />
              <!-- value with dropdown -->
              <v-combobox
                v-else-if="
                  conf_entry.type == ConfigEntryType.STRING &&
                  conf_entry.multi_value
                "
                v-model="conf_entry.value as string[]"
                multiple
                chips
                :clearable="true"
                :disabled="conf_entry.read_only"
                :label="
                  $t(`settings.${conf_entry.key}.label`, conf_entry.label)
                "
                :required="conf_entry.required"
                :rules="[
                  (v) =>
                    !(!v && conf_entry.required) ||
                    $t('settings.invalid_input'),
                ]"
                variant="outlined"
                @click:clear="conf_entry.value = conf_entry.default_value"
              />
              <!-- all other: textbox with single value -->
              <v-text-field
                v-else
                v-model="conf_entry.value"
                :placeholder="conf_entry.default_value?.toString()"
                clearable
                :disabled="conf_entry.read_only"
                :label="
                  $t(`settings.${conf_entry.key}.label`, conf_entry.label)
                "
                :required="conf_entry.required"
                :rules="[
                  (v) =>
                    !(!v && conf_entry.required) ||
                    $t('settings.invalid_input'),
                ]"
                variant="outlined"
                :readonly="!!conf_entry.action"
                @click:clear="conf_entry.value = conf_entry.default_value"
              />
            </div>
            <!-- right side of control: help icon with description-->
            <div
              v-if="hasDescriptionOrHelpLink(conf_entry)"
              class="configcolumnright"
            >
              <v-btn
                icon="mdi-help-box"
                variant="plain"
                class="helpicon"
                size="x-large"
                @click="
                  $t(
                    `settings.${conf_entry?.key}.description`,
                    conf_entry.description || '',
                  )
                    ? (showHelpInfo = conf_entry)
                    : openLink(conf_entry.help_link!)
                "
              />
            </div>
          </div>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
    <br />
    <v-btn
      block
      color="primary"
      :disabled="!requiredValuesPresent"
      @click="submit"
    >
      {{ $t("settings.save") }}
    </v-btn>
  </v-form>
  <br />
  <v-btn block @click="router.back()">
    {{ $t("close") }}
  </v-btn>
  <v-dialog
    :model-value="showHelpInfo !== undefined"
    width="auto"
    @update:model-value="showHelpInfo = undefined"
  >
    <v-card>
      <v-card-text>
        <h2>
          {{
            $t(`settings.${showHelpInfo?.key}.label`, showHelpInfo?.label || "")
          }}
        </h2>
      </v-card-text>
      <!-- eslint-disable vue/no-v-html -->
      <!-- eslint-disable vue/no-v-text-v-html-on-component -->
      <v-card-text
        v-html="
          markdownToHtml(
            $t(
              `settings.${showHelpInfo?.key}.description`,
              showHelpInfo?.description || '',
            ),
          )
        "
      />
      <!-- eslint-enable vue/no-v-html -->
      <!-- eslint-enable vue/no-v-text-v-html-on-component -->
      <v-card-actions>
        <v-btn
          v-if="showHelpInfo?.help_link"
          @click="openLink(showHelpInfo!.help_link!)"
        >
          {{ $t("read_more") }}
        </v-btn>
        <v-spacer />
        <v-btn color="primary" @click="showHelpInfo = undefined">
          {{ $t("close") }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, VNodeRef, computed, watch } from "vue";
import { useRouter } from "vue-router";
import {
  ConfigEntryType,
  ConfigValueType,
  SECURE_STRING_SUBSTITUTE,
  ConfigEntry,
  ConfigValueOption,
} from "@/plugins/api/interfaces";
import { markdownToHtml } from "@/helpers/utils";
import { $t } from "@/plugins/i18n";
const router = useRouter();

export interface Props {
  configEntries: ConfigEntry[];
  disabled: boolean;
}

const emit = defineEmits<{
  (e: "submit", values: Record<string, ConfigValueType>): void;
  (e: "action", action: string, values: Record<string, ConfigValueType>): void;
}>();

// global refs
const entries = ref<ConfigEntry[]>();
const valid = ref(false);
const form = ref<VNodeRef>();
const activePanel = ref<string>("generic");
const showPasswordValues = ref(false);
const showHelpInfo = ref<ConfigEntry>();
const oldValues = ref<Record<string, ConfigValueType>>({});

// props
const props = defineProps<Props>();

// computed props
const panels = computed(() => {
  // determine all unique categories from the config entries
  const allCategories = new Set(
    entries
      .value!.map((x) => x.category)
      .filter((x) => !["generic", "advanced"].includes(x)),
  );
  // ensure generic is always first and advanced always last
  return ["generic", ...allCategories, "advanced"];
});
const requiredValuesPresent = computed(() => {
  if (entries.value) {
    for (const entry of entries.value) {
      if (
        entry.required &&
        !(
          !isNullOrUndefined(entry.value) ||
          !isNullOrUndefined(entry.default_value) ||
          entry.type == ConfigEntryType.DIVIDER ||
          entry.type == ConfigEntryType.LABEL ||
          entry.type == ConfigEntryType.ALERT ||
          entry.type == ConfigEntryType.ACTION
        )
      )
        return false;
    }
    return true;
  }
  return false;
});

// watchers
watch(
  () => props.configEntries,
  (val) => {
    entries.value = [];
    for (const entry of val || []) {
      // handle missing values (undefined or null)
      if (entry.value !== undefined && entry.value !== null)
        oldValues.value[entry.key] = entry.value;
      if (entry.value == undefined || entry.value == null)
        entry.value = entry.default_value;
      entries.value.push(entry);
    }
  },
  { immediate: true },
);

// methods
const validate = async function () {
  const { valid } = await (form.value as any).validate();
  return valid;
};
const submit = async function () {
  // submit button is pressed
  if (await validate()) {
    emit("submit", getCurrentValues());
  }
};
const action = async function (action: string) {
  // call config entries action
  emit("action", action, getCurrentValues());
};
const openLink = function (url: string) {
  // window.open(url, "_blank");
  const a = document.createElement("a");
  a.setAttribute("href", url);
  a.setAttribute("target", "_blank");
  a.click();
};

const entriesForCategory = function (category: string) {
  return entries.value!.filter((x) => x.category == category && isVisible(x));
};

const openDspConfig = function () {
  router.push(`${router.currentRoute.value.path}/dsp`);
};
const isNullOrUndefined = function (value: unknown) {
  return value === null || value === undefined;
};
const isVisible = function (entry: ConfigEntry) {
  if (entry.hidden) return false;
  // check if the UI element should be hidden due to 'depends_on' conditions
  if (!isNullOrUndefined(entry.depends_on)) {
    const dependent = entries.value?.find((x) => x.key == entry.depends_on);
    if (dependent) {
      const dependentValue = dependent.value;
      if (!isNullOrUndefined(entry.depends_on_value)) {
        return dependentValue == entry.depends_on_value;
      }
      if (!isNullOrUndefined(entry.depends_on_value_not)) {
        return dependentValue != entry.depends_on_value_not;
      }
      if (dependent.required && isNullOrUndefined(dependent)) return true;
      if (dependent.type == ConfigEntryType.BOOLEAN && !dependentValue)
        return false;
    }
  }
  return true;
};
const getCurrentValues = function () {
  const values: Record<string, ConfigValueType> = {};
  for (const entry of props.configEntries!) {
    // filter out undefined values
    if (entry.value == undefined) entry.value = null;
    // filter out obfuscated strings
    if (
      entry.type == ConfigEntryType.SECURE_STRING &&
      entry.value == SECURE_STRING_SUBSTITUTE
    ) {
      continue;
    }
    values[entry.key] = entry.value;
  }
  return values;
};
const getTranslatedOptions = function (entry: ConfigEntry) {
  if (!entry.options) return [];
  const options: ConfigValueOption[] = [];
  for (const orgOption of entry.options) {
    // handle weird edge case where value or title contains
    // a special character which is not handled well by i18n
    // for example "@" in a HA entity name
    let cleanVal = orgOption.value?.toString() || "";
    let cleanTitle = orgOption.title?.toString() || "";
    for (const specialChar of ["@", "$", "|"]) {
      if (cleanVal.includes(specialChar)) {
        cleanVal = cleanVal.replaceAll(specialChar, "");
      }
      if (cleanTitle.includes(specialChar)) {
        cleanTitle = cleanTitle.toString().replaceAll(specialChar, "");
      }
    }
    let title = $t(`settings.${entry.key}.options.${cleanVal}`, cleanTitle);
    const option: ConfigValueOption = {
      title: title,
      value: orgOption.value,
    };
    if (option.value == entry.default_value) {
      option.title += ` [${$t("settings.default")}]`;
    }
    options.push(option);
  }
  return options;
};

const hasDescriptionOrHelpLink = function (conf_entry: ConfigEntry) {
  // overly complicated way to determine we have a description for the entry
  // in either the translations (by entry key), on the entry itself as fallback
  // OR it has a help link
  return (
    (
      $t(
        `settings.${conf_entry?.key}.description`,
        conf_entry.description || " ",
      ) ||
      conf_entry.help_link ||
      " "
    )?.length > 1
  );
};
</script>

<style scoped>
.configrow {
  display: flex;
  width: 100%;
  padding: 0;
}

.configcolumnleft {
  flex: 90%;
}

.configcolumnright {
  align-content: flex-end;
  vertical-align: middle;
}

.helpicon {
  margin-top: 0px;
  margin-right: -10px;
}

.actionbutton.v-btn.v-btn--density-default {
  height: 50px;
  width: 100%;
  margin-top: 0px;
  margin-bottom: 10px;
}

div.v-expansion-panel {
  background-color: transparent;
}

.configrowpanel :deep(.v-expansion-panel-title) {
  padding: 0;
  padding-right: 5px;
}
.configrowpanel :deep(.v-expansion-panel-text__wrapper) {
  padding: 0;
}
</style>
