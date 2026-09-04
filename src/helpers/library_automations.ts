import { $t, i18n } from "@/plugins/i18n";

// Trigger/action metadata (id, label, description) is authored server-side in plain English
// (music_assistant/providers/library_automations/{triggers,actions}.py) and is not routed
// through server-side i18n. Look up a frontend translation by id first, falling back to the
// server-provided text for any trigger/action type that doesn't have one yet (e.g. a newly
// added server-side type before the frontend catches up).
function localized(key: string, fallback: string): string {
  return i18n.global.te(key) ? $t(key) : fallback;
}

export function localizedTriggerTitle(id: string, fallback: string): string {
  return localized(
    `providers.library_automations.trigger.${id}.title`,
    fallback,
  );
}

export function localizedTriggerDescription(
  id: string,
  fallback: string,
): string {
  return localized(
    `providers.library_automations.trigger.${id}.description`,
    fallback,
  );
}

export function localizedActionTitle(id: string, fallback: string): string {
  return localized(
    `providers.library_automations.action.${id}.title`,
    fallback,
  );
}

export function localizedActionDescription(
  id: string,
  fallback: string,
): string {
  return localized(
    `providers.library_automations.action.${id}.description`,
    fallback,
  );
}

/** Extract a human-readable message from an sendCommand rejection. */
export const errorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (error && typeof error === "object") {
    const data = error as Record<string, unknown>;
    for (const key of ["message", "error", "detail", "reason"]) {
      if (typeof data[key] === "string" && data[key].trim()) {
        return data[key];
      }
    }
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
};
