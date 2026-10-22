import { copyToClipboard } from "@/helpers/utils";
import { $t } from "@/plugins/i18n";
import { toast } from "vue-sonner";

export async function copyProviderLink(url: string): Promise<void> {
  const success = await copyToClipboard(url);
  if (success) toast.success($t("provider_links.copied"));
  else toast.error($t("provider_links.copy_failed"));
}

export async function shareProviderLink(
  url: string,
  title: string,
): Promise<void> {
  if (typeof navigator.share !== "function") {
    await copyProviderLink(url);
    return;
  }
  try {
    await navigator.share({ url, title });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") return;
    toast.error($t("provider_links.share_failed"));
  }
}
