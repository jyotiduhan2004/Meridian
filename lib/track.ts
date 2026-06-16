// Safe Pendo (Novus) event tracking. Never throws and no-ops if the agent
// hasn't loaded yet, so it can be called freely from anywhere in the UI.
export function trackEvent(
  name: string,
  properties?: Record<string, string | number | boolean>,
): void {
  try {
    if (typeof window !== "undefined" && window.pendo) {
      window.pendo.track(name, properties);
    }
  } catch {
    /* never let tracking break the app */
  }
}
