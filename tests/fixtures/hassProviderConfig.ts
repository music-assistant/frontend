import {
  ConfigEntryType,
  type ProviderConfig,
  ProviderType,
} from "@/plugins/api/interfaces";
import { providerConfig } from "./providerConfig";
import { providerManifest } from "./providerManifest";

/**
 * The Home Assistant provider config, carrying the given power controls.
 */
export function hassProviderConfig(
  powerControls: string[] | null,
): ProviderConfig {
  return providerConfig({
    type: ProviderType.PLUGIN,
    domain: "hass",
    manifest: providerManifest({
      type: ProviderType.PLUGIN,
      domain: "hass",
      name: "Home Assistant",
      description: "Home Assistant integration",
    }),
    values: {
      power_controls: {
        key: "power_controls",
        type: ConfigEntryType.STRING,
        label: "Power controls",
        default_value: [],
        required: false,
        options: [],
        category: "generic",
        multi_value: true,
        value: powerControls,
      },
    },
  });
}
