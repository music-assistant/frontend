import { appUrlOf, readSetupEntry, type SetupEntry } from "@/helpers/first_run";
import { getDeviceName } from "@/plugins/api/helpers";
import { authManager } from "@/plugins/auth";
import { computed, ref } from "vue";

/** What the account step asks for. */
export interface AccountDetails {
  username: string;
  password: string;
  displayName: string;
}

/**
 * What happens once the account is there: the app signs in with it, or the
 * browser is on its way to the client that started the setup, token in hand.
 */
export type AccountOutcome = "signing_in" | "handed_back";

/** The account could not be created, for the reason the server gave, if any. */
export class AccountSetupError extends Error {
  constructor(public readonly reason: string | null) {
    super(reason ?? "Account setup failed");
    this.name = "AccountSetupError";
  }
}

// the setup this page load was sent to; null on any other visit
const entry = ref<SetupEntry | null>(null);
// whether the account is there, so the app can sign in with it
const accountCreated = ref(false);

const firstRun = computed(() => entry.value != null);
// nothing can sign in before the account exists, so nothing tries to
const awaitingAccount = computed(() => firstRun.value && !accountCreated.value);

/**
 * Take the page url in as the app boots, and say whether it is the server's
 * first-run setup page. When it is, the setup is remembered and the browser
 * is moved onto the server's own path, so the connection and the sign-in run
 * from there like on any other visit.
 */
export function enterFirstRunSetup(): boolean {
  const found = readSetupEntry(window.location);
  if (!found) return false;
  entry.value = found;
  window.history.replaceState({}, "", appUrlOf(window.location));
  return true;
}

/** The first run is over: the wizard that hosted it has finished. */
export function leaveFirstRunSetup(): void {
  entry.value = null;
  accountCreated.value = false;
}

// the server's setup endpoint, on the same server the page came from
function setupUrl(): string {
  return `${window.location.origin}${window.location.pathname.replace(/\/$/, "")}/setup`;
}

/**
 * Create the first admin account. On success the app holds a token for it and
 * signs in with it, unless an external client started the setup, in which case
 * the browser is sent on to that client with the token instead. Throws an
 * `AccountSetupError` when the server did not create the account.
 */
async function createAccount(details: AccountDetails): Promise<AccountOutcome> {
  const setup = entry.value;
  const body: Record<string, string> = {
    username: details.username,
    password: details.password,
    // the client that started the setup names its own token; the app names
    // this one after the browser, like a sign-in does
    device_name: setup?.deviceName || getDeviceName(),
  };
  if (details.displayName) body.display_name = details.displayName;
  if (setup?.returnUrl) body.return_url = setup.returnUrl;

  let response: Response;
  try {
    response = await fetch(setupUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.error("[FirstRunSetup] Account request failed:", error);
    throw new AccountSetupError(null);
  }
  const answer = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    token?: string;
    error?: string;
    redirect_to?: string;
  };
  if (!response.ok || !answer.success || !answer.token) {
    throw new AccountSetupError(answer.error || null);
  }
  if (answer.redirect_to) {
    window.location.assign(answer.redirect_to);
    return "handed_back";
  }
  authManager.setToken(answer.token);
  accountCreated.value = true;
  return "signing_in";
}

/**
 * The first-run setup, shared by the app shell and the wizard's account step.
 * Module-level on purpose: whether this page load is a first run is settled
 * as the app boots, and the sign-in the shell normally starts with has to
 * wait on the account the step makes.
 */
export function useFirstRunSetup() {
  return {
    firstRun,
    awaitingAccount,
    createAccount,
  };
}
