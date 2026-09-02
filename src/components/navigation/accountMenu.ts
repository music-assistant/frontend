export const ACCOUNT_ACCENT_CLASSES = [
  "border-primary/60 bg-primary/100",
  "border-emerald-500/60 bg-emerald-500/100",
  "border-amber-500/60 bg-amber-500/100",
  "border-rose-500/60 bg-rose-500/100",
  "border-violet-500/60 bg-violet-500/100",
  "border-cyan-500/60 bg-cyan-500/100",
  "border-orange-500/60 bg-orange-500/100",
  "border-pink-500/60 bg-pink-500/100",
] as const;

const ACCOUNT_SWITCHER_ACCENT_CLASSES = [
  "border-primary/60 bg-primary/10",
  "border-emerald-500/60 bg-emerald-500/10",
  "border-amber-500/60 bg-amber-500/10",
  "border-rose-500/60 bg-rose-500/10",
  "border-violet-500/60 bg-violet-500/10",
  "border-cyan-500/60 bg-cyan-500/10",
  "border-orange-500/60 bg-orange-500/10",
  "border-pink-500/60 bg-pink-500/10",
] as const;

const ACCOUNT_GLOW_BACKGROUND_CLASSES = [
  "bg-primary/60",
  "bg-emerald-500/60",
  "bg-amber-500/60",
  "bg-rose-500/60",
  "bg-violet-500/60",
  "bg-cyan-500/60",
  "bg-orange-500/60",
  "bg-pink-500/60",
] as const;

const ACCOUNT_BUTTON_ACCENT_CLASSES = [
  "data-[state=open]:bg-primary/10",
  "data-[state=open]:bg-emerald-500/10",
  "data-[state=open]:bg-amber-500/10",
  "data-[state=open]:bg-rose-500/10",
  "data-[state=open]:bg-violet-500/10",
  "data-[state=open]:bg-cyan-500/10",
  "data-[state=open]:bg-orange-500/10",
  "data-[state=open]:bg-pink-500/10",
] as const;

function accountAccentIndex(username: string): number {
  const key = username.trim().toLowerCase();
  let hash = 0;
  for (const character of key) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return hash % ACCOUNT_ACCENT_CLASSES.length;
}

/** Return a stable accent based on the public username, never a credential. */
export function accountAccentClass(username: string): string {
  return ACCOUNT_ACCENT_CLASSES[accountAccentIndex(username)] ?? "";
}

export function accountAccentBackgroundClass(username: string): string {
  return ACCOUNT_GLOW_BACKGROUND_CLASSES[accountAccentIndex(username)] ?? "";
}

export function accountSwitcherAccentClass(username: string): string {
  return ACCOUNT_SWITCHER_ACCENT_CLASSES[accountAccentIndex(username)] ?? "";
}

export function accountAccentButtonClass(username: string): string {
  return ACCOUNT_BUTTON_ACCENT_CLASSES[accountAccentIndex(username)] ?? "";
}

export type ConnectionStatusKey =
  | "connected"
  | "connecting"
  | "disconnected"
  | "failed";

export function getConnectionStatusKey(state: string): ConnectionStatusKey {
  switch (state) {
    case "connected":
    case "authenticated":
    case "initialized":
      return "connected";
    case "connecting":
    case "authenticating":
    case "reconnecting":
      return "connecting";
    case "failed":
      return "failed";
    default:
      return "disconnected";
  }
}
