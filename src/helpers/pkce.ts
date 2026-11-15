/**
 * PKCE (RFC 7636) helpers for sign-ins that the app completes itself.
 *
 * Needs a secure context: crypto.subtle is missing on plain http origins.
 */

/**
 * Return a new random code verifier of 43 characters.
 */
export function createCodeVerifier(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

/**
 * Return the S256 code challenge of a code verifier.
 *
 * :param verifier: The code verifier.
 */
export async function createCodeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return toBase64Url(new Uint8Array(digest));
}

function toBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
