/**
 * Whether a host page frames the app, such as the Home Assistant panel.
 *
 * A host keeps navigation to itself, so gestures the browser normally runs
 * over the whole window do not reach us there and are ours to bring.
 */
export function isEmbedded(): boolean {
  return window.self !== window.top;
}
