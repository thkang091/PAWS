import type { AnalyticsEventName, AnalyticsProperties, AnalyticsProvider } from "@/types/analytics";

const devProvider: AnalyticsProvider = {
  track: (eventName, properties) => {
    if (__DEV__) {
      console.info("[analytics]", eventName, properties ?? {});
    }
  },
};

let provider: AnalyticsProvider = devProvider;

export const setAnalyticsProvider = (nextProvider: AnalyticsProvider): void => {
  provider = nextProvider;
};

export const trackEvent = (eventName: AnalyticsEventName, properties?: AnalyticsProperties): void => {
  try {
    void provider.track(eventName, properties);
  } catch {
    if (__DEV__) {
      console.warn("[analytics] event failed", eventName);
    }
  }
};
