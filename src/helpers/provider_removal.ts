import { type ProviderConfig, ProviderType } from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";

// provider types whose removal takes more with it than the provider itself
const REMOVAL_MESSAGE_KEYS: Partial<Record<ProviderType, string>> = {
  [ProviderType.MUSIC]: "settings.remove_provider_confirm_music",
  [ProviderType.PLAYER]: "settings.remove_provider_confirm_player",
};

/**
 * Asks for confirmation before removing a provider, stating what is removed
 * along with it. Removing a music source has to be acknowledged explicitly.
 */
export const confirmProviderRemoval = function (
  config: ProviderConfig,
  name: string,
  onConfirm: () => void | Promise<void>,
): void {
  const messageKey =
    REMOVAL_MESSAGE_KEYS[config.type] ?? "settings.remove_provider_confirm";
  eventbus.emit("deleteConfirmationDialog", {
    title: $t("settings.remove_provider"),
    message: $t(messageKey, [name]),
    confirmLabel: $t("settings.remove_provider"),
    acknowledgement:
      config.type === ProviderType.MUSIC
        ? $t("settings.remove_provider_acknowledge")
        : undefined,
    onConfirm,
  });
};
