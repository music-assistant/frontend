// What the user is told after a one-shot action ran: an action button of a
// settings form, or a menu entry a provider declares.
import { openActionResultUrl } from "@/helpers/utils";
import type { ConfigActionResult } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { toast } from "vue-sonner";

/**
 * Show the outcome of a one-shot action: open its url once, and say what
 * happened in its own message or, without one, that it is done.
 *
 * @param result - What the action answered, if anything.
 */
export const showActionResult = (result: ConfigActionResult | null) => {
  openActionResultUrl(result?.open_url);
  toast.success(result?.message || $t("settings.action_completed"));
};
