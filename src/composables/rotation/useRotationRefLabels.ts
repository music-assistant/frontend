import api from "@/plugins/api";
import type { RotationDescribe } from "@/plugins/api/interfaces";
import { refLabelFallback } from "@/helpers/rotation";
import { $t } from "@/plugins/i18n";
import { ref, watch } from "vue";

type Providers = RotationDescribe["providers"];

const URI_FIELDS = ["artist", "album"];

/**
 * Display names for the values of a reference field.
 * @param field Getter for the field name (artist, album, genre, provider, album_type or audio_quality).
 * @param values Getter for the stored values.
 * @param providers Getter for the providers a client may choose from.
 */
export function useRotationRefLabels(
  field: () => string,
  values: () => string[],
  providers: () => Providers = () => [],
) {
  const resolved = ref<Record<string, string>>({});
  const requested = new Set<string>();

  async function resolve(uri: string) {
    requested.add(uri);
    try {
      const item = await api.getItemByUri(uri);
      resolved.value = { ...resolved.value, [uri]: item.name };
    } catch {
      // an item that is gone keeps showing its id
      resolved.value = { ...resolved.value, [uri]: refLabelFallback(uri) };
    }
  }

  watch(
    values,
    (current) => {
      if (!URI_FIELDS.includes(field())) return;
      for (const uri of current) {
        if (uri && !requested.has(uri)) void resolve(uri);
      }
    },
    { immediate: true },
  );

  /** Remember the name of an item that was just picked. */
  function remember(value: string, name: string) {
    requested.add(value);
    resolved.value = { ...resolved.value, [value]: name };
  }

  function labelOf(value: string): string {
    switch (field()) {
      case "genre":
        return value;
      case "album_type":
        return $t(`album_type.${value}`);
      case "audio_quality":
        return $t(`rotation.audio_quality.${value}`);
      case "provider":
        return providers().find((p) => p.instance_id === value)?.name ?? value;
      default:
        return resolved.value[value] ?? refLabelFallback(value);
    }
  }

  return { labelOf, remember };
}
