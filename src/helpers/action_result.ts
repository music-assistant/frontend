// What the user is told after a one-shot action ran: an action button of a
// settings form, or a menu entry a provider declares.
import { openActionResultUrl } from "@/helpers/utils";
import { $t } from "@/plugins/i18n";
import { toast } from "vue-sonner";

/**
 * Show the outcome of a one-shot action: open its url once, and say what
 * happened in its own message or, without one, that it is done. An answer that
 * is not a result counts as one without a message or a url.
 *
 * @param result - What the action answered (a ConfigActionResult, or nothing).
 */
export const showActionResult = (result: unknown) => {
  const outcome: Record<string, unknown> =
    result && typeof result === "object" ? { ...result } : {};
  openActionResultUrl(
    typeof outcome.open_url === "string" ? outcome.open_url : null,
  );
  toast.success(
    typeof outcome.message === "string" && outcome.message
      ? outcome.message
      : $t("settings.action_completed"),
  );
};
