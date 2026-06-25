"use strict";

(function setupAnalytics() {
  const config = window.TEMPERATURE_TOOL_ANALYTICS || {};
  let fallbackMode = false;
  let fallbackPageviewSent = false;

  function sendPixel(endpoint, path, title) {
    if (!endpoint || !path) return;
    const params = new URLSearchParams();
    params.set("p", path);
    if (title) params.set("t", title);
    if (document.referrer) params.set("r", document.referrer);
    const image = new Image(1, 1);
    image.src = `${endpoint}?${params.toString()}`;
  }

  const analytics = {
    enabled: false,
    provider: config.provider || "none",
    queue: [],
    endpoint: "",
    trackEvent(path, title) {
      if (!this.enabled || !path) return;
      if (fallbackMode) {
        sendPixel(this.endpoint, path, title || path);
        return;
      }
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
  analytics.endpoint = endpoint;
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
  script.addEventListener("error", () => {
    fallbackMode = true;
    if (!fallbackPageviewSent) {
      fallbackPageviewSent = true;
      sendPixel(endpoint, window.location.pathname || "/", document.title);
    }
    while (analytics.queue.length) {
      const event = analytics.queue.shift();
      sendPixel(endpoint, event.path, event.title);
    }
  });
  document.head.appendChild(script);
}());
