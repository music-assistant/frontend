import en from "@/translations/en.json";
import navHeaderSource from "@/components/navigation/NavHeaderMenu.vue?raw";
import reloadPromptSource from "@/layouts/default/ReloadPrompt.vue?raw";
import { describe, expect, it } from "vitest";

describe("sidebar update indicator", () => {
  it("uses the shared PWA update state in the sidebar menu", () => {
    expect(navHeaderSource).toContain('usePwaUpdate"');
    expect(navHeaderSource).toContain(
      "const { needRefresh, updateServiceWorker }",
    );
    expect(navHeaderSource).toContain(':aria-label="menuTriggerLabel"');
    expect(navHeaderSource).toContain('v-if="needRefresh"');
    expect(navHeaderSource).toContain('aria-hidden="true"');
    expect(navHeaderSource).toContain('role="status"');
    expect(navHeaderSource).toContain('@click="applyUpdate"');
    expect(navHeaderSource).toContain('{{ $t("update_available") }}');
    expect(navHeaderSource).toContain('{{ $t("reload") }}');
  });

  it("keeps update availability when the reload prompt is dismissed", () => {
    expect(reloadPromptSource).toContain('usePwaUpdate"');
    expect(reloadPromptSource).toContain("const promptDismissed = ref(false)");
    expect(reloadPromptSource).toContain("showUpdatePrompt");
    expect(reloadPromptSource).toContain("promptDismissed.value = true");
    expect(reloadPromptSource).not.toContain("needRefresh.value = false");
  });

  it("has the translations needed by both update surfaces", () => {
    expect(en.update_available).toBeTruthy();
    expect(en.reload).toBeTruthy();
    expect(en.settings.open_menu).toBeTruthy();
  });
});
