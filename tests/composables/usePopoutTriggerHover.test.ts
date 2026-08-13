import { usePopoutTriggerHover } from "@/composables/usePopoutTriggerHover";
import { describe, expect, it } from "vitest";
import { nextTick, ref } from "vue";

const arrives = (pointerType: string) =>
  new PointerEvent("pointerenter", { pointerType });

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
    const { suppressHover, onPointerEnter } = usePopoutTriggerHover(
      () => open.value,
    );

    onPointerEnter(arrives("touch"));
    open.value = false;
    await nextTick();

    expect(suppressHover.value).toBe(true);
  });

  it("trusts it again once the pointer arrives on the button", async () => {
    const open = ref(true);
    const { suppressHover, onPointerEnter } = usePopoutTriggerHover(
      () => open.value,
    );

    open.value = false;
    await nextTick();
    onPointerEnter(arrives("touch"));

    expect(suppressHover.value).toBe(false);
  });

  // clicking the popout shut fires no pointerenter of its own, so nothing later
  // would tell the button the mouse never went anywhere
  it("keeps trusting a mouse that is still on the button", async () => {
    const open = ref(false);
    const { suppressHover, onPointerEnter } = usePopoutTriggerHover(
      () => open.value,
    );

    onPointerEnter(arrives("mouse"));
    open.value = true;
    await nextTick();
    open.value = false;
    await nextTick();

    expect(suppressHover.value).toBe(false);
  });

  // on a touchscreen laptop both pointers reach the same button, and the finger
  // that tapped it last is the one that left the hover behind
  it("stops trusting a mouse hover a finger has landed on top of", async () => {
    const open = ref(false);
    const { suppressHover, onPointerEnter } = usePopoutTriggerHover(
      () => open.value,
    );

    onPointerEnter(arrives("mouse"));
    onPointerEnter(arrives("touch"));
    open.value = true;
    await nextTick();
    open.value = false;
    await nextTick();

    expect(suppressHover.value).toBe(true);
  });
});
