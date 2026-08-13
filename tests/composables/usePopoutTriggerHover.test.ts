import { usePopoutTriggerHover } from "@/composables/usePopoutTriggerHover";
import { describe, expect, it } from "vitest";
import { nextTick, ref } from "vue";

describe("usePopoutTriggerHover", () => {
  it("leaves the button alone while its popout opens", async () => {
    const open = ref(false);
    const { suppressHover } = usePopoutTriggerHover(() => open.value);

    open.value = true;
    await nextTick();

    expect(suppressHover.value).toBe(false);
  });

  // the tap that opened the popout keeps hovering the button on touch, so the
  // button would stay highlighted after a swipe or a tap outside dismissed it
  it("stops trusting the hover once the popout closes", async () => {
    const open = ref(true);
    const { suppressHover } = usePopoutTriggerHover(() => open.value);

    open.value = false;
    await nextTick();

    expect(suppressHover.value).toBe(true);
  });

  it("trusts it again once the pointer arrives on the button", async () => {
    const open = ref(true);
    const { suppressHover, releaseHover } = usePopoutTriggerHover(
      () => open.value,
    );

    open.value = false;
    await nextTick();
    releaseHover();

    expect(suppressHover.value).toBe(false);
  });
});
