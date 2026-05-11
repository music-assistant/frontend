export const CLASSICAL_TABS = ["composers", "works", "performers"] as const;

export type ClassicalTab = (typeof CLASSICAL_TABS)[number];

export const CLASSICAL_DEFAULT_TAB: ClassicalTab = "composers";

export const CLASSICAL_LAST_TAB_KEY = "frontend.classical.last_tab";

export function isClassicalTab(value: unknown): value is ClassicalTab {
  return (
    typeof value === "string" &&
    (CLASSICAL_TABS as readonly string[]).includes(value)
  );
}

export function getLastVisitedClassicalTab(): ClassicalTab {
  const stored = localStorage.getItem(CLASSICAL_LAST_TAB_KEY);
  return isClassicalTab(stored) ? stored : CLASSICAL_DEFAULT_TAB;
}
