const EXPECTED_ONESIGNAL_APP_ID = "e1183bae-f7b7-4122-90a7-10d72adf87e2";

function doGet(event) {
  const parameters = typeof event === "undefined" ? {} : event.parameter || {};
  const nonce = String(parameters.status || "");
  const callback = String(parameters.callback || "");
  if (/^[a-f0-9]{32}$/.test(nonce) && callback === "kalyanBroadcastStatus") {
    const cached = CacheService.getScriptCache().get("broadcast-result-" + nonce);
    let result = { nonce: nonce, pending: true };
    if (cached) {
      try {
        result = JSON.parse(cached);
      } catch (error) {
        result = { nonce: nonce, ok: false, message: "The sender returned an invalid status response." };
      }
    }
    const json = JSON.stringify(result).replace(/</g, "\\u003c");
    return ContentService
      .createTextOutput("kalyanBroadcastStatus(" + json + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput("Kalyan Gold notification sender is ready.")
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(event) {
  const parameters = event && event.parameter ? event.parameter : {};
  const nonce = String(parameters.nonce || "");
  let response;

  try {
    if (!/^[a-f0-9]{32}$/.test(nonce)) {
      throw new Error("Invalid request identifier.");
    }

    const properties = PropertiesService.getScriptProperties();
    const expectedToken = String(properties.getProperty("BROADCAST_TOKEN") || "").trim();
    const providedToken = String(parameters.token || "").trim();
    if (expectedToken.length < 24 || !constantTimeEquals(providedToken, expectedToken)) {
      throw new Error("Sender authentication failed. Check the broadcast token.");
    }
    const appId = properties.getProperty("ONESIGNAL_APP_ID") || "";
    const restApiKey = properties.getProperty("ONESIGNAL_REST_API_KEY") || "";
    if (!appId || !restApiKey) {
      throw new Error("OneSignal server properties are not configured.");
    }
    if (appId !== EXPECTED_ONESIGNAL_APP_ID) {
      throw new Error("ONESIGNAL_APP_ID does not match the app configured in the A2 Morning native app. Update the Script Property and deploy this version.");
    }

    const heading = String(parameters.heading || "").trim();
    const message = String(parameters.message || "").trim();
    const imageUrl = String(parameters.imageUrl || "").trim();
    let externalIds;
    try {
      externalIds = JSON.parse(String(parameters.externalIds || "[]"));
    } catch (error) {
      throw new Error("The native player audience is invalid. Refresh the admin page and try again.");
    }
    if (!heading || heading.length > 80 || !message || message.length > 1000) {
      throw new Error("Enter a title up to 80 characters and a message up to 1000 characters.");
    }
    if (!/^https:\/\/[^\s]+$/i.test(imageUrl)) {
      throw new Error("The notification logo must have a public HTTPS URL.");
    }
    if (!Array.isArray(externalIds)) {
      throw new Error("The native player audience is invalid. Refresh the admin page and try again.");
    }
    externalIds = Array.from(new Set(externalIds
      .filter((id) => typeof id === "string")
      .map((id) => id.trim())
      .filter((id) => /^\d{10,}$/.test(id))));
    if (!externalIds.length) {
      throw new Error("No native player external IDs were provided. Refresh the admin page and try again.");
    }
    if (externalIds.length > 20000) {
      throw new Error("The native audience exceeds OneSignal's 20,000-user per-message limit.");
    }
    const requestCache = CacheService.getScriptCache();
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) {
      throw new Error("Another notification request is being processed. Try again shortly.");
    }
    try {
      const nonceCacheKey = "broadcast-" + nonce;
      if (requestCache.get(nonceCacheKey)) {
        throw new Error("This notification request has already been processed.");
      }
      requestCache.put(nonceCacheKey, "processed", 21600);
    } finally {
      lock.releaseLock();
    }

    const notification = {
      app_id: appId,
      target_channel: "push",
      include_aliases: { external_id: externalIds },
      isAndroid: true,
      headings: { en: heading },
      contents: { en: message },
      chrome_web_icon: imageUrl,
      chrome_web_image: imageUrl,
      data: { source: "kalyan-gold-admin" },
    };
    const result = UrlFetchApp.fetch("https://api.onesignal.com/notifications?c=push", {
      method: "post",
      contentType: "application/json",
      headers: { Authorization: "Key " + restApiKey },
      payload: JSON.stringify(notification),
      muteHttpExceptions: true,
    });
    const status = result.getResponseCode();
    let resultBody;
    try {
      resultBody = JSON.parse(result.getContentText());
    } catch (error) {
      throw new Error("OneSignal returned an unreadable response (HTTP " + status + ").");
    }
    if (status < 200 || status >= 300 || resultBody.errors) {
      const details = Array.isArray(resultBody.errors)
        ? resultBody.errors.join("; ")
        : typeof resultBody.errors === "string"
          ? resultBody.errors
          : resultBody.errors
            ? JSON.stringify(resultBody.errors)
            : "OneSignal rejected the request (HTTP " + status + ").";
      if (/all included players are not subscribed/i.test(details)) {
        throw new Error("OneSignal found no subscribed Android push devices among the native player external IDs. Confirm the current native app has logged these players in to this same OneSignal app, and that their Android subscriptions are marked Subscribed.");
      }
      throw new Error(details);
    }

    const recipients = Number(resultBody.recipients);
    if (!Number.isFinite(recipients) || recipients <= 0) {
      throw new Error("OneSignal found no subscribed Android push devices among the native player external IDs. Confirm the current native app has logged these players in to this same OneSignal app, and that their Android subscriptions are marked Subscribed.");
    }
    response = {
      ok: true,
      message: "Push notification sent to all subscribed users.",
      recipients: recipients,
      notificationId: String(resultBody.id || ""),
    };
  } catch (error) {
    response = {
      ok: false,
      message: error instanceof Error ? error.message : "Notification sending failed.",
    };
  }

  if (/^[a-f0-9]{32}$/.test(nonce)) {
    CacheService.getScriptCache().put(
      "broadcast-result-" + nonce,
      JSON.stringify({ nonce: nonce, ...response }),
      3600
    );
  }
  return ContentService
    .createTextOutput("Notification request processed.")
    .setMimeType(ContentService.MimeType.TEXT);
}

function constantTimeEquals(left, right) {
  const leftDigest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, left);
  const rightDigest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, right);
  let difference = leftDigest.length ^ rightDigest.length;
  for (let index = 0; index < leftDigest.length; index += 1) {
    difference |= leftDigest[index] ^ rightDigest[index];
  }
  return difference === 0;
}
