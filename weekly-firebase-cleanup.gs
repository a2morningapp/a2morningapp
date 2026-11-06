const CLEANUP_DATABASE_URL = "https://a2morning-in-website-new-db-default-rtdb.firebaseio.com";
const CLEANUP_DATABASE_HOST = "a2morning-in-website-new-db-default-rtdb.firebaseio.com";
const CLEANUP_CONFIRMATION_VALUE = "DELETE_SELECTED_HISTORY_KEEP_BALANCES_V1";
const CLEANUP_TIME_ZONE = "Asia/Kolkata";
const CLEANUP_TRIGGER_HOUR = 2;
const CLEANUP_TRIGGER_FUNCTION = "runWeeklyCleanup";
const CLEANUP_CLEARED_ADMIN_COLLECTIONS = [
  "bets",
  "transactions",
  "settlements",
  "requests",
];

function runWeeklyCleanup() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    throw new Error("A weekly cleanup is already running. Try again later.");
  }

  try {
    const plan = buildWeeklyCleanupPlan_();
    const enabled = PropertiesService.getScriptProperties()
      .getProperty("WEEKLY_CLEANUP_ENABLED") === "true";
    const confirmation = PropertiesService.getScriptProperties()
      .getProperty("WEEKLY_CLEANUP_CONFIRMATION");

    if (!enabled || confirmation !== CLEANUP_CONFIRMATION_VALUE) {
      const preview = {
        mode: "DRY_RUN",
        message: "No Firebase data was changed. Review this preview before enabling cleanup.",
        counts: plan.counts,
        pathsToClear: plan.pathsToClear,
        marketResultUpdates: plan.marketResultUpdates,
      };
      Logger.log(JSON.stringify(preview));
      return preview;
    }

    const updateCount = Object.keys(plan.updates).length;
    if (updateCount === 0) {
      const empty = { mode: "LIVE", message: "No matching data was found.", counts: plan.counts };
      Logger.log(JSON.stringify(empty));
      return empty;
    }

    firebaseRequest_("PATCH", "", plan.updates);
    const complete = {
      mode: "LIVE",
      message: "Selected weekly history was cleared. Player accounts, balances, markets, settings, and credentials were preserved.",
      counts: plan.counts,
      updatedPaths: updateCount,
    };
    Logger.log(JSON.stringify(complete));
    return complete;
  } finally {
    lock.releaseLock();
  }
}

function installWeeklyCleanupTrigger() {
  if (Session.getScriptTimeZone() !== CLEANUP_TIME_ZONE) {
    throw new Error(
      "Set the Apps Script project time zone to " + CLEANUP_TIME_ZONE
      + " in Project Settings before installing the weekly trigger."
    );
  }

  const matchingTriggers = ScriptApp.getProjectTriggers().filter(
    (trigger) => trigger.getHandlerFunction() === CLEANUP_TRIGGER_FUNCTION
  );
  matchingTriggers.forEach((trigger) => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger(CLEANUP_TRIGGER_FUNCTION)
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.SUNDAY)
    .atHour(CLEANUP_TRIGGER_HOUR)
    .create();

  Logger.log("Installed weekly cleanup trigger for Sunday at approximately 02:00 Asia/Kolkata.");
}

function removeWeeklyCleanupTrigger() {
  const matchingTriggers = ScriptApp.getProjectTriggers().filter(
    (trigger) => trigger.getHandlerFunction() === CLEANUP_TRIGGER_FUNCTION
  );
  matchingTriggers.forEach((trigger) => ScriptApp.deleteTrigger(trigger));
  Logger.log("Removed " + matchingTriggers.length + " weekly cleanup trigger(s).");
}

function buildWeeklyCleanupPlan_() {
  const updates = {
    "Normal T Data": null,
    "Normal T Data2": null,
    DR: null,
    WR: null,
    Results: null,
  };

  const counts = {
    bidDetailPlayers: countChildren_(firebaseRequest_("GET", "Normal T Data")),
    bidHistoryPlayers: countChildren_(firebaseRequest_("GET", "Normal T Data2")),
    depositRequests: countChildren_(firebaseRequest_("GET", "DR")),
    withdrawalRequests: countChildren_(firebaseRequest_("GET", "WR")),
    publishedResultMarkets: countChildren_(firebaseRequest_("GET", "Results")),
    marketResultRecordsReset: 0,
    adminBets: countChildren_(firebaseRequest_("GET", "adminData/bets")),
    adminTransactions: countChildren_(firebaseRequest_("GET", "adminData/transactions")),
    adminSettlements: countChildren_(firebaseRequest_("GET", "adminData/settlements")),
    adminRequests: countChildren_(firebaseRequest_("GET", "adminData/requests")),
  };

  for (const bucket of ["GAMES", "GAMES2", "GAMES3"]) {
    const games = firebaseRequest_("GET", bucket);
    if (!games || typeof games !== "object") continue;

    for (const [key, rawGame] of Object.entries(games)) {
      if (key === "x" || rawGame === null || rawGame === undefined) continue;
      const reset = resetLegacyMarketResult_(bucket, key, rawGame);
      if (!reset) continue;
      Object.assign(updates, reset);
      counts.marketResultRecordsReset += 1;
    }
  }

  const markets = firebaseRequest_("GET", "adminData/markets");
  if (markets && typeof markets === "object") {
    for (const [key, market] of Object.entries(markets)) {
      if (!market || typeof market !== "object" || key === "x") continue;
      const marketPath = firebasePath_("adminData", "markets", key);
      const placeholder = marketPlaceholder_(market.type || market.name);
      updates[marketPath + "/results"] = null;
      updates[marketPath + "/result"] = placeholder;
      updates[marketPath + "/openResult"] = null;
      updates[marketPath + "/closeResult"] = null;
      updates[marketPath + "/resultDate"] = "";

      if (Array.isArray(market.legacyFields)) {
        const fields = market.legacyFields.slice();
        fields[6] = placeholder;
        fields[8] = resetMetadata_(fields[8]);
        updates[marketPath + "/legacyFields"] = fields;
        counts.marketResultRecordsReset += 1;
      }
    }
  }

  CLEANUP_CLEARED_ADMIN_COLLECTIONS.forEach((collection) => {
    updates["adminData/" + collection] = null;
  });

  return {
    updates,
    counts,
    pathsToClear: [
      "/Normal T Data",
      "/Normal T Data2",
      "/DR",
      "/WR",
      "/Results",
      ...CLEANUP_CLEARED_ADMIN_COLLECTIONS.map((path) => "/adminData/" + path),
    ],
    marketResultUpdates: counts.marketResultRecordsReset,
  };
}

function resetLegacyMarketResult_(bucket, key, rawGame) {
  const path = firebasePath_(bucket, key);
  if (typeof rawGame === "string") {
    if (!rawGame.trim().startsWith("[")) return null;

    let fields;
    try {
      fields = JSON.parse(rawGame);
    } catch (error) {
      throw new Error("Invalid market JSON at /" + path + ": " + error.message);
    }
    if (!Array.isArray(fields)) {
      throw new Error("Expected a market array at /" + path + ".");
    }

    fields[6] = marketPlaceholder_(fields[0]);
    if (fields.length > 8 && fields[8] !== null && fields[8] !== undefined) {
      fields[8] = resetMetadata_(fields[8]);
    }
    return { [path]: JSON.stringify(fields) };
  }

  if (rawGame && typeof rawGame === "object") {
    const placeholder = marketPlaceholder_(rawGame.type || rawGame.name);
    const updates = {};
    if (Object.prototype.hasOwnProperty.call(rawGame, "result")) {
      updates[path + "/result"] = placeholder;
    }
    if (Object.prototype.hasOwnProperty.call(rawGame, "openResult")) {
      updates[path + "/openResult"] = null;
    }
    if (Object.prototype.hasOwnProperty.call(rawGame, "closeResult")) {
      updates[path + "/closeResult"] = null;
    }
    if (Object.prototype.hasOwnProperty.call(rawGame, "resultDate")) {
      updates[path + "/resultDate"] = "";
    }
    if (Object.prototype.hasOwnProperty.call(rawGame, "results")) {
      updates[path + "/results"] = null;
    }
    return Object.keys(updates).length ? updates : null;
  }

  return null;
}

function resetMetadata_(value) {
  if (typeof value === "string") {
    if (!value.trim()) return value;
    let metadata;
    try {
      metadata = JSON.parse(value);
    } catch (error) {
      throw new Error("Invalid market metadata: " + error.message);
    }
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
      throw new Error("Expected market metadata to be an object.");
    }
    metadata.resultDate = "";
    return JSON.stringify(metadata);
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    const metadata = Object.assign({}, value, { resultDate: "" });
    return metadata;
  }

  return value;
}

function marketPlaceholder_(marketNameOrType) {
  return /starline/i.test(String(marketNameOrType || ""))
    ? "### - #"
    : "### - ## - ###";
}

function countChildren_(value) {
  if (!value || typeof value !== "object") return 0;
  return Object.keys(value).filter((key) => key !== "x").length;
}

function firebasePath_() {
  const parts = Array.prototype.slice.call(arguments).map(String);
  parts.forEach((part) => {
    if (!part || /[.#$\[\]/]/.test(part)) {
      throw new Error("Invalid Firebase path segment: " + part);
    }
  });
  return parts.join("/");
}

function firebaseRequest_(method, path, payload) {
  const properties = PropertiesService.getScriptProperties();
  const serviceAccountEmail = String(
    properties.getProperty("FIREBASE_SERVICE_ACCOUNT_EMAIL") || ""
  ).trim();
  const privateKey = String(
    properties.getProperty("FIREBASE_PRIVATE_KEY") || ""
  ).replace(/\\n/g, "\n").trim();
  if (!serviceAccountEmail || !privateKey) {
    throw new Error(
      "Set FIREBASE_SERVICE_ACCOUNT_EMAIL and FIREBASE_PRIVATE_KEY in Apps Script properties."
    );
  }
  if (!/^[^@\s]+@[^@\s]+\.iam\.gserviceaccount\.com$/.test(serviceAccountEmail)) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_EMAIL must be the service-account email ending in .iam.gserviceaccount.com, not a personal Gmail address."
    );
  }
  if (!/^-----BEGIN (?:RSA )?PRIVATE KEY-----[\s\S]+-----END (?:RSA )?PRIVATE KEY-----$/.test(privateKey)) {
    throw new Error(
      "FIREBASE_PRIVATE_KEY must be the PEM private_key from the downloaded service-account JSON, starting with -----BEGIN PRIVATE KEY-----. A Firebase Web API key (AIza...), database URL, or access token cannot be used."
    );
  }

  const host = CLEANUP_DATABASE_URL.replace(/^https:\/\//, "").replace(/\/+$/, "");
  if (host !== CLEANUP_DATABASE_HOST) {
    throw new Error("Cleanup is restricted to the Sridevi Matka primary Realtime Database.");
  }

  const encodedPath = path
    ? path.split("/").map(encodeURIComponent).join("/")
    : "";
  const url = CLEANUP_DATABASE_URL + "/" + encodedPath + ".json?access_token="
    + encodeURIComponent(firebaseAccessToken_(serviceAccountEmail, privateKey));
  const options = {
    method: method.toLowerCase(),
    contentType: "application/json",
    muteHttpExceptions: true,
  };
  if (payload !== undefined) options.payload = JSON.stringify(payload);

  const response = UrlFetchApp.fetch(url, options);
  const status = response.getResponseCode();
  const body = response.getContentText();
  if (status < 200 || status >= 300) {
    throw new Error("Firebase " + method + " failed (" + status + "): " + body);
  }
  if (!body) return null;
  try {
    return JSON.parse(body);
  } catch (error) {
    throw new Error("Firebase returned invalid JSON: " + error.message);
  }
}

function firebaseAccessToken_(serviceAccountEmail, privateKey) {
  const cache = CacheService.getScriptCache();
  const cached = cache.get("weekly-cleanup-firebase-access-token");
  if (cached) return cached;

  const issuedAt = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: serviceAccountEmail,
    scope: "https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email",
    aud: "https://oauth2.googleapis.com/token",
    iat: issuedAt,
    exp: issuedAt + 3600,
  };
  const unsignedToken = base64WebSafe_(JSON.stringify(header)) + "."
    + base64WebSafe_(JSON.stringify(claims));
  let signature;
  try {
    signature = Utilities.computeRsaSha256Signature(unsignedToken, privateKey);
  } catch (error) {
    throw new Error(
      "Could not sign the Firebase service-account token. Confirm FIREBASE_PRIVATE_KEY is the complete, unmodified PEM private_key from that service account's JSON file. Details: "
      + error.message
    );
  }
  const assertion = unsignedToken + "." + base64WebSafe_(signature);
  const response = UrlFetchApp.fetch("https://oauth2.googleapis.com/token", {
    method: "post",
    payload: {
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    },
    muteHttpExceptions: true,
  });
  const status = response.getResponseCode();
  const body = response.getContentText();
  if (status < 200 || status >= 300) {
    throw new Error("Google service-account authentication failed (" + status + "): " + body);
  }

  let tokenResponse;
  try {
    tokenResponse = JSON.parse(body);
  } catch (error) {
    throw new Error("Google returned invalid token JSON: " + error.message);
  }
  if (!tokenResponse.access_token) {
    throw new Error("Google did not return an access token.");
  }
  cache.put("weekly-cleanup-firebase-access-token", tokenResponse.access_token, 3000);
  return tokenResponse.access_token;
}

function base64WebSafe_(value) {
  return Utilities.base64EncodeWebSafe(value).replace(/=+$/, "");
}
