import { api } from "@/plugins/api";
import type { ProviderManifest } from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";

/**
 * Start adding a provider: its setup flow, or, while the provider it depends on
 * is not set up, the offer to set that one up first.
 *
 * @param manifest - The manifest of the provider to add.
 * @param onStart - Called right before a setup flow opens, for a caller that
 *   closes itself.
 */
export function startAddProvider(
  manifest: ProviderManifest,
  onStart?: () => void,
) {
  const dependsOn = manifest.depends_on;
  if (dependsOn && !api.getProvider(dependsOn)) {
    // the provider it depends on has to be set up first, so offer that flow
    // instead of this one
    const dependencyName = api.getProviderName(dependsOn);
    eventbus.emit("deleteConfirmationDialog", {
      title: $t("settings.setup_flow.setup_title", [dependencyName]),
      message: $t("settings.provider_depends_on_confirm", [
        manifest.name,
        dependencyName,
      ]),
      confirmLabel: $t("settings.start_setup"),
      destructive: false,
      onConfirm: () => {
        onStart?.();
        eventbus.emit("setupFlowDialog", {
          kind: "provider",
          domain: dependsOn,
        });
      },
    });
    return;
  }
  onStart?.();
  eventbus.emit("setupFlowDialog", {
    kind: "provider",
    domain: manifest.domain,
  });
}
