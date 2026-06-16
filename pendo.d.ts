export {};

declare global {
  interface Window {
    pendo?: {
      track(
        eventName: string,
        properties?: Record<string, string | number | boolean>,
      ): void;
    };
  }
}
