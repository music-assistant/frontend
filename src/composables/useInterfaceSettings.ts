import { ref } from "vue";

import { setUserPreferences } from "@/composables/userPreferences";
import { DEVICE_SETTING_KEYS } from "@/constants";
import {
  BROWSER_MEDIA_CONTROLS,
  BrowserMediaControlsMode,
  getBrowserMediaControlsMode,
  MOBILE_SIDEBAR_SIDE,
  readDeviceSetting,
  saveDeviceSetting,
} from "@/helpers/device_settings";
import { expertMode, expertModeSetting } from "@/helpers/expert_mode";
import {
  ConfigEntry,
  ConfigEntryType,
  ConfigValueType,
} from "@/plugins/api/interfaces";
import { companionMode } from "@/plugins/companion";
import { eventbus } from "@/plugins/eventbus";
import { getKioskModePreference } from "@/plugins/homeassistant";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";

/**
 * Where an interface setting is kept: on the account, following the user to
 * every device, or on this device only.
 */
export type InterfaceSettingsStorage = "account" | "device";

// The volume slider reads these as computed refs, so saving one takes effect
// immediately and a reload would achieve nothing.
const RELOAD_EXEMPT_PREFERENCE_KEYS = new Set([
  "volume_slider_mode",
  "volume_haptics",
]);

/**
 * The interface settings kept on the account or on this device, as entries for
 * the settings form, and how to store them: the preferences on the account, and
 * the settings of this device in its local storage.
 */
export function useInterfaceSettings(storage: InterfaceSettingsStorage) {
  const entries = ref<ConfigEntry[]>(
    localizeEntries(
      storage === "device" ? buildDeviceEntries() : buildAccountEntries(),
    ),
  );

  // The form hands back every entry on save, not just the edited ones, so the
  // values it submits are compared against these to tell a real change from a
  // re-save of what was already there. Held serialized: the form edits entry.value
  // in place, which an array or object snapshot would follow.
  const initialValues: Record<string, string> = Object.fromEntries(
    entries.value.map((entry) => [entry.key, serializeValue(entry.value)]),
  );

  /**
   * Store the values the form submits: the device settings on this device, and
   * the preferences that changed on the account. Resolves whether the app has
   * to reload before those changes show.
   */
  const save = async function (
    values: Record<string, ConfigValueType>,
  ): Promise<boolean> {
    let hasPerUserChanges = false;

    for (const key in values) {
      const entry = entries.value.find((e) => e.key === key);
      if (!entry) continue;
      // Action-only entries carry no persistable value
      if (entry.type === ConfigEntryType.ACTION) continue;

      if (DEVICE_SETTING_KEYS.has(key)) {
        // Save to localStorage (per-device settings)
        const value = values[key];
        saveDeviceSetting(key, value != null ? value.toString() : null);
      } else {
        // an entry left as it was is not written: a default that is only
        // derived, like the waveform's from the expert mode, must not turn
        // into a choice on the account by way of an unrelated save
        const serialized = serializeValue(values[key]);
        if (serialized === initialValues[key]) continue;
        // Save to backend via user preferences; the caller reports a write
        // the server did not take, so the api's own error stays out of it
        const stored = await setUserPreferences(
          { [key]: values[key] },
          { suppressGlobalError: true },
        );
        if (!stored) throw new Error(`Could not save the preference ${key}`);
        // the form stays on screen, so the next save compares against this
        initialValues[key] = serialized;
        if (!RELOAD_EXEMPT_PREFERENCE_KEYS.has(key)) hasPerUserChanges = true;
      }
    }
    return hasPerUserChanges;
  };

  /**
   * Run the action of an entry.
   */
  const onAction = function (action: string): void {
    if (action === "customize_menu") {
      // Put the navigation menu in edit mode, right next to these settings.
      store.navMenuEditMode = true;
      if (store.mobileLayout) eventbus.emit("mobile-sidebar-open");
    }
  };

  /**
   * Store the values of the entries that apply as soon as they are set.
   */
  const applyImmediately = function (
    values: Record<string, ConfigValueType>,
  ): void {
    for (const key in values) {
      saveDeviceSetting(key, String(values[key]));
    }
  };

  return { entries, save, onAction, applyImmediately };
}

function serializeValue(value: ConfigValueType | undefined): string {
  return JSON.stringify(value ?? null);
}

// the preferences saved to the account, which follow the user to every device
function buildAccountEntries(): ConfigEntry[] {
  return [
    {
      // Menu items are managed in the sidebar's edit mode; this button is the
      // muscle-memory path for users who look for the old setting here.
      key: "customize_menu",
      type: ConfigEntryType.ACTION,
      label: "customize_menu",
      action: "customize_menu",
      default_value: null,
      required: false,
      options: [],
      multi_value: false,
      category: "preferences",
      value: null,
    },
    {
      key: "show_waveform",
      type: ConfigEntryType.BOOLEAN,
      label: "show_waveform",
      default_value: expertMode(),
      required: false,
      options: [],
      multi_value: false,
      category: "preferences",
      value: expertModeSetting("show_waveform"),
    },
    {
      key: "show_letter_index",
      type: ConfigEntryType.BOOLEAN,
      label: "show_letter_index",
      default_value: false,
      required: false,
      options: [],
      multi_value: false,
      category: "preferences",
      value:
        (store.currentUser?.preferences?.show_letter_index as boolean) ?? false,
    },
    {
      key: "audiobook_chapter_progress",
      type: ConfigEntryType.BOOLEAN,
      label: "audiobook_chapter_progress",
      default_value: true,
      required: false,
      options: [],
      multi_value: false,
      category: "audiobooks",
      value:
        (store.currentUser?.preferences
          ?.audiobook_chapter_progress as boolean) ?? true,
    },
    {
      key: "volume_slider_mode",
      type: ConfigEntryType.STRING,
      label: "volume_slider_mode",
      default_value: "absolute",
      required: false,
      options: [
        { title: "absolute", value: "absolute" },
        { title: "relative", value: "relative" },
      ],
      multi_value: false,
      category: "volume_control",
      value:
        (store.currentUser?.preferences?.volume_slider_mode as string) ||
        "absolute",
    },
    {
      key: "volume_haptics",
      type: ConfigEntryType.BOOLEAN,
      label: "volume_haptics",
      default_value: true,
      required: false,
      options: [],
      multi_value: false,
      category: "volume_control",
      value:
        (store.currentUser?.preferences?.volume_haptics as boolean) ?? true,
    },
  ];
}

// the settings of this browser; each key is listed in DEVICE_SETTING_KEYS
function buildDeviceEntries(): ConfigEntry[] {
  const configEntries: ConfigEntry[] = [
    {
      key: BROWSER_MEDIA_CONTROLS,
      type: ConfigEntryType.STRING,
      label: "enable_browser_controls",
      default_value: BrowserMediaControlsMode.WEB_PLAYER,
      required: false,
      options: [
        {
          title: "active_player",
          value: BrowserMediaControlsMode.ACTIVE_PLAYER,
        },
        {
          title: "web_player",
          value: BrowserMediaControlsMode.WEB_PLAYER,
        },
        {
          title: "disabled",
          value: BrowserMediaControlsMode.DISABLED,
        },
      ],
      multi_value: false,
      category: "display_settings",
      hidden: companionMode.value,
      value: getBrowserMediaControlsMode(),
    },
    {
      key: "force_mobile_layout",
      type: ConfigEntryType.BOOLEAN,
      label: "force_mobile_layout",
      default_value: false,
      required: false,
      options: [],
      multi_value: false,
      category: "display_settings",
      value:
        localStorage.getItem("frontend.settings.force_mobile_layout") ===
        "true",
    },
    {
      key: "mobile_sidebar_side",
      type: ConfigEntryType.STRING,
      label: "mobile_sidebar_side",
      default_value: "left",
      required: false,
      options: [
        { title: "Left", value: "left" },
        { title: "Right", value: "right" },
      ],
      multi_value: false,
      category: "display_settings",
      value: readDeviceSetting(MOBILE_SIDEBAR_SIDE) || "left",
    },
    {
      // Only Home Assistant can give up its own chrome, so this is meaningless
      // anywhere else.
      key: "ha_kiosk_mode",
      type: ConfigEntryType.BOOLEAN,
      label: "ha_kiosk_mode",
      default_value: true,
      required: false,
      options: [],
      multi_value: false,
      category: "display_settings",
      hidden: !store.isIngressSession,
      value: getKioskModePreference(),
    },
  ];

  // Add web player settings (if not running in companion mode)
  if (!companionMode.value) {
    configEntries.push({
      key: "web_player_enabled",
      type: ConfigEntryType.BOOLEAN,
      label: "web_player_enabled",
      default_value: true,
      required: false,
      options: [],
      category: "web_player",
      value:
        localStorage.getItem("frontend.settings.web_player_enabled") !==
        "false",
    });
  }
  return configEntries;
}

function localizeEntries(configEntries: ConfigEntry[]): ConfigEntry[] {
  // These are frontend-only settings, so the frontend owns their translations (server-provided
  // entries are localized server-side and arrive pre-resolved). ConfigEntryField renders labels
  // and option content directly, so resolve the frontend-owned ones here from the settings.* keys.
  for (const entry of configEntries) {
    // fall back to the in-code label/category if a locale is missing the string, so we never
    // surface a raw i18n key in the UI.
    entry.label = $t(`settings.${entry.key}.label`, entry.label ?? entry.key);
    if (entry.category) {
      // frontend-only entries carry their translated category heading directly (server entries
      // get category_label resolved server-side); EditConfig just reads category_label.
      entry.category_label = $t(
        `settings.category.${entry.category}`,
        entry.category,
      );
    }
    const desc = $t(`settings.${entry.key}.description`);
    if (desc !== `settings.${entry.key}.description`) entry.description = desc;
    entry.options = entry.options.map((opt) => {
      const descriptionKey = `settings.${entry.key}.option_descriptions.${opt.value}`;
      const description = $t(descriptionKey);
      return {
        ...opt,
        title: $t(
          `settings.${entry.key}.options.${opt.value}`,
          opt.title ?? String(opt.value),
        ),
        description:
          description === descriptionKey ? opt.description : description,
      };
    });
  }
  return configEntries;
}
