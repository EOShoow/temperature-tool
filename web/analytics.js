"use strict";

(function setupAnalytics() {
  const config = window.TEMPERATURE_TOOL_ANALYTICS || {};
  const analytics = {
    enabled: false,
    provider: config.provider || "none",
    queue: [],
    trackEvent(path, title) {
      if (!this.enabled || !path) return;
      const event = { path, title: title || path, event: true };
      if (window.goatcounter?.count) {
        window.goatcounter.count(event);
        return;
      }
      this.queue.push(event);
    },
  };

  window.temperatureToolAnalytics = analytics;

  if (analytics.provider !== "goatcounter") return;

  const endpoint = config.goatcounterEndpoint || (
    config.goatcounterCode ? `https://${config.goatcounterCode}.goatcounter.com/count` : ""
  );
  if (!endpoint) return;

  analytics.enabled = true;
  window.goatcounter = {
    ...(window.goatcounter || {}),
    allow_local: Boolean(config.countLocal),
  };

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://gc.zgo.at/count.js";
  script.dataset.goatcounter = endpoint;
  script.addEventListener("load", () => {
    while (analytics.queue.length && window.goatcounter?.count) {
      window.goatcounter.count(analytics.queue.shift());
    }
  });
  document.head.appendChild(script);
}());
