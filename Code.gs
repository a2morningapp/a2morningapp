const EXPECTED_ONESIGNAL_APP_ID = "e1183bae-f7b7-4122-90a7-10d72adf87e2";
const SENDER_VERSION = "2026-10-08-android-subscription-export-1";

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
    .createTextOutput("Kalyan Gold notification sender is ready. Version: " + SENDER_VERSION)
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

    const subscriptionIds = getSubscribedAndroidSubscriptionIds(appId, restApiKey);
    if (!subscriptionIds.length) {
      throw new Error("OneSignal's subscription export contains no currently subscribed Android devices for this app. Verify the Android rows are marked Subscribed in this same app and refresh the dashboard.");
    }

    const notification = {
      app_id: appId,
      target_channel: "push",
      include_subscription_ids: subscriptionIds,
      headings: { en: heading },
      contents: { en: message },
      chrome_web_icon: imageUrl,
      chrome_web_image: imageUrl,
      large_icon: imageUrl,
      big_picture: imageUrl,
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
        throw new Error("OneSignal did not accept any of the current Android subscription IDs. Refresh the native app's subscription in OneSignal and verify that its REST API key belongs to this app.");
      }
      throw new Error(details);
    }

    const recipients = Number(resultBody.recipients);
    if (!Number.isFinite(recipients) || recipients <= 0) {
      throw new Error("OneSignal returned zero recipients for the current Android subscription IDs. Check the subscription status in OneSignal and verify the Apps Script uses the current App API key.");
    }
    response = {
      ok: true,
      message: "Push notification sent to all subscribed users.",
      recipients: recipients,
      notificationId: String(resultBody.id || ""),
      version: SENDER_VERSION,
    };
  } catch (error) {
    response = {
      ok: false,
      message: error instanceof Error ? error.message : "Notification sending failed.",
      version: SENDER_VERSION,
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

function getSubscribedAndroidSubscriptionIds(appId, restApiKey) {
  const exportResponse = UrlFetchApp.fetch(
    "https://api.onesignal.com/players/csv_export?app_id=" + encodeURIComponent(appId),
    {
      method: "post",
      contentType: "application/json",
      headers: { Authorization: "Key " + restApiKey },
      payload: JSON.stringify({
        extra_fields: ["external_user_id", "onesignal_id"],
      }),
      muteHttpExceptions: true,
    }
  );
  const exportStatus = exportResponse.getResponseCode();
  let exportBody;
  try {
    exportBody = JSON.parse(exportResponse.getContentText());
  } catch (error) {
    throw new Error("OneSignal returned an unreadable subscription export response (HTTP " + exportStatus + ").");
  }
  if (exportStatus < 200 || exportStatus >= 300 || !exportBody.csv_file_url) {
    throw new Error("OneSignal could not export this app's subscriptions (HTTP " + exportStatus + "). Check that the Script Property contains this app's App API key.");
  }

  let csvResponse = null;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    csvResponse = UrlFetchApp.fetch(exportBody.csv_file_url, {
      muteHttpExceptions: true,
    });
    if (csvResponse.getResponseCode() === 200) break;
    if (csvResponse.getResponseCode() !== 404) {
      throw new Error("OneSignal's subscription export download failed (HTTP " + csvResponse.getResponseCode() + ").");
    }
    Utilities.sleep(1000);
  }
  if (!csvResponse || csvResponse.getResponseCode() !== 200) {
    throw new Error("OneSignal is still preparing the subscription export. Wait briefly and retry once.");
  }

  let csvText;
  try {
    csvText = Utilities.ungzip(csvResponse.getBlob()).getDataAsString("UTF-8");
  } catch (error) {
    throw new Error("Could not decompress OneSignal's subscription export.");
  }
  const rows = Utilities.parseCsv(csvText);
  if (!rows.length) {
    throw new Error("OneSignal's subscription export was empty.");
  }
  const columns = rows[0].map((column) => String(column || "").trim());
  const idColumn = columns.indexOf("id");
  const deviceTypeColumn = columns.indexOf("device_type");
  const invalidIdentifierColumn = columns.indexOf("invalid_identifier");
  if (idColumn < 0 || deviceTypeColumn < 0 || invalidIdentifierColumn < 0) {
    throw new Error("OneSignal's subscription export is missing required ID or subscription-status columns.");
  }

  const subscriptionIds = new Set();
  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const id = String(row[idColumn] || "").trim();
    const deviceType = String(row[deviceTypeColumn] || "").trim();
    const isUnsubscribed = String(row[invalidIdentifierColumn] || "").trim().toLowerCase() === "t";
    if (deviceType === "1"
      && !isUnsubscribed
      && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) {
      subscriptionIds.add(id);
    }
  }
  if (subscriptionIds.size > 20000) {
    throw new Error("The native Android audience exceeds OneSignal's 20,000-subscription per-message limit.");
  }
  return Array.from(subscriptionIds);
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
