import { inject, provide, type InjectionKey } from "vue";

const detailAdminCardKey: InjectionKey<boolean> = Symbol("detail-admin-card");

export function provideDetailAdminCard(): void {
  provide(detailAdminCardKey, true);
}

// sections inside the admin card sit on the card, so they drop their top padding
export function useSectionBodyPadding(): string {
  return inject(detailAdminCardKey, false) ? "px-3 pb-3" : "p-2.5";
}
