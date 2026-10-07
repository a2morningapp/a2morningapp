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

    const heading = String(parameters.heading || "").trim();
    const message = String(parameters.message || "").trim();
    const imageUrl = String(parameters.imageUrl || "").trim();
    if (!heading || heading.length > 80 || !message || message.length > 1000) {
      throw new Error("Enter a title up to 80 characters and a message up to 1000 characters.");
    }
    if (!/^https:\/\/[^\s]+$/i.test(imageUrl)) {
      throw new Error("The notification logo must have a public HTTPS URL.");
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
      included_segments: ["Subscribed Users"],
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
        throw new Error("No users are subscribed to push notifications yet. Each user must allow notifications in their browser and enable push notifications on the player website.");
      }
      throw new Error(details);
    }

    const recipients = Number(resultBody.recipients);
    if (!Number.isFinite(recipients) || recipients <= 0) {
      throw new Error("OneSignal found no subscribed users to notify. Each user must allow notifications in their browser and enable push notifications on the player website.");
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
