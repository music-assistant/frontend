import OnboardingDialog from "@/components/onboarding/OnboardingDialog.vue";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref } from "vue";

vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

vi.mock("@/composables/useOnboarding", async () => {
  const { ref, computed } = await vi.importActual<typeof import("vue")>("vue");
  return {
    useOnboarding: () => ({
      active: ref(true),
      ctx: computed(() => ({ isMember: false })),
      close: vi.fn(),
      markWelcomed: vi.fn(),
    }),
  };
});

vi.mock("@/components/onboarding/OnboardingWizard.vue", () => ({
  __esModule: true,
  default: { template: "<div />" },
}));

const zIndex = (element: Element | null): number =>
  Number(element?.className.match(/\bz-\[(\d+)\]/)?.[1]);

const overlayOf = (content: Element | null): Element | null => {
  let node = content?.previousElementSibling ?? null;
  while (node && node.getAttribute("data-slot") !== "dialog-overlay") {
    node = node.previousElementSibling;
  }
  return node;
};

enableAutoUnmount(afterEach);

describe("OnboardingDialog stacking", () => {
  it("lets a dialog opened from the wizard show on top of it", async () => {
    // the app shell's dialogs mount before the wizard, so the DOM order alone
    // would keep the wizard on top
    const setupOpen = ref(false);
    const Host = defineComponent(() => () => [
      h(Dialog, { open: setupOpen.value }, () =>
        h(DialogContent, { "data-testid": "setup" }, () => "setup"),
      ),
      h(OnboardingDialog),
    ]);
    mount(Host, { attachTo: document.body });
    await flushPromises();
    setupOpen.value = true;
    await flushPromises();

    const setup = document.querySelector("[data-testid=setup]");
    const wizard = document.querySelector("[data-testid=onboarding-modal]");
    expect(zIndex(overlayOf(setup))).toBeGreaterThan(zIndex(wizard));
    expect(zIndex(setup)).toBeGreaterThan(zIndex(wizard));
    expect(zIndex(overlayOf(wizard))).toBe(zIndex(wizard));
  });
});
