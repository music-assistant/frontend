import z from "zod";

import { type ConfigEntryUI, isInjected } from "@/helpers/config_entry_ui";
import {
  ConfigEntryType,
  type ConfigValueType,
} from "@/plugins/api/interfaces";

const NON_VALUE_TYPES = new Set<string>([
  ConfigEntryType.DIVIDER,
  ConfigEntryType.LABEL,
  ConfigEntryType.ALERT,
  ConfigEntryType.ACTION,
]);

export const isFormValueEntry = (entry: ConfigEntryUI): boolean => {
  if (isInjected(entry)) return false;
  if (NON_VALUE_TYPES.has(entry.type)) return false;
  return true;
};

type FormValues = Record<string, ConfigValueType>;

export const isEntryDisabled = (
  entry: ConfigEntryUI,
  values: FormValues,
  entries: ConfigEntryUI[],
): boolean => {
  if (entry.depends_on === null || entry.depends_on === undefined) return false;
  const dependent = entries.find((x) => x.key === entry.depends_on);
  if (!dependent) return false;
  const dependentValue = values[dependent.key] ?? dependent.value;

  if (entry.depends_on_value !== null && entry.depends_on_value !== undefined) {
    return dependentValue != entry.depends_on_value;
  }
  if (
    entry.depends_on_value_not !== null &&
    entry.depends_on_value_not !== undefined
  ) {
    return dependentValue == entry.depends_on_value_not;
  }
  return !dependentValue;
};

export const buildConfigDefaults = (entries: ConfigEntryUI[]): FormValues => {
  const defaults: FormValues = {};
  for (const entry of entries) {
    if (!isFormValueEntry(entry)) continue;
    const value =
      entry.value === undefined || entry.value === null
        ? entry.default_value
        : entry.value;
    defaults[entry.key] = value ?? null;
  }
  return defaults;
};

const isEmptyValue = (value: ConfigValueType): boolean => {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.length === 0;
  if (Array.isArray(value)) return value.length === 0;

  return false;
};

export const buildConfigSchema = (
  entries: ConfigEntryUI[],
  t: (key: string) => string,
) => {
  const valueEntries = entries.filter(isFormValueEntry);
  const requiredMsg = t("settings.invalid_input");

  return z.record(z.string(), z.any()).superRefine((values, ctx) => {
    const vals = values as FormValues;
    for (const entry of valueEntries) {
      if (isEntryDisabled(entry, vals, entries)) continue;
      const value = vals[entry.key];

      if (entry.required && isEmptyValue(value)) {
        ctx.addIssue({
          code: "custom",
          path: [entry.key],
          message: requiredMsg,
        });
        continue;
      }

      if (
        (entry.type === ConfigEntryType.INTEGER ||
          entry.type === ConfigEntryType.FLOAT) &&
        entry.range &&
        entry.range.length === 2 &&
        typeof value === "number"
      ) {
        if (value < entry.range[0] || value > entry.range[1]) {
          ctx.addIssue({
            code: "custom",
            path: [entry.key],
            message: requiredMsg,
          });
        }
      }
    }
  });
};
