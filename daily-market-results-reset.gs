const DAILY_RESULT_RESET_DATABASE_URL = "https://a2morning-in-website-new-db-default-rtdb.firebaseio.com";
const DAILY_RESULT_RESET_DATABASE_HOST = "a2morning-in-website-new-db-default-rtdb.firebaseio.com";
const DAILY_RESULT_RESET_CONFIRMATION = "RESET_DAILY_MARKET_RESULTS_KEEP_HISTORY_V1";
const DAILY_RESULT_RESET_TIME_ZONE = "Asia/Kolkata";
const DAILY_RESULT_RESET_HOUR = 2;
const DAILY_RESULT_RESET_HANDLER = "runDailyMarketResultReset";
const DAILY_RESULT_RESET_PLACEHOLDER = "### - ## - ###";

function runDailyMarketResultReset() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    throw new Error("A market-result reset is already running. Try again later.");
  }

  try {
    const plan = buildDailyMarketResultResetPlan_();
    const properties = PropertiesService.getScriptProperties();
    const enabled = properties.getProperty("DAILY_RESULT_RESET_ENABLED") === "true";
    const confirmation = properties.getProperty("DAILY_RESULT_RESET_CONFIRMATION");
    if (!enabled || confirmation !== DAILY_RESULT_RESET_CONFIRMATION) {
      const preview = {
        mode: "DRY_RUN",
        message: "No Firebase data was changed. Review this preview before enabling the daily reset.",
        datesCleared: plan.datesCleared,
        counts: plan.counts,
        pathsToUpdate: Object.keys(plan.updates).length,
      };
      Logger.log(JSON.stringify(preview));
      return preview;
    }

    const pathsToUpdate = Object.keys(plan.updates).length;
    if (!pathsToUpdate) {
      const empty = {
        mode: "LIVE",
        message: "No current market result records needed resetting.",
        datesCleared: plan.datesCleared,
        counts: plan.counts,
      };
      Logger.log(JSON.stringify(empty));
      return empty;
    }

    dailyResultResetFirebaseRequest_("PATCH", "", plan.updates);
    const complete = {
      mode: "LIVE",
      message: "Current market results were reset. Older result history was preserved.",
      datesCleared: plan.datesCleared,
      counts: plan.counts,
      pathsUpdated: pathsToUpdate,
    };
    Logger.log(JSON.stringify(complete));
    return complete;
  } finally {
    lock.releaseLock();
  }
}

function installDailyMarketResultResetTrigger() {
  if (Session.getScriptTimeZone() !== DAILY_RESULT_RESET_TIME_ZONE) {
    throw new Error(
      "Set the Apps Script project time zone to " + DAILY_RESULT_RESET_TIME_ZONE
      + " in Project Settings before installing the daily trigger."
    );
  }

  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === DAILY_RESULT_RESET_HANDLER)
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger(DAILY_RESULT_RESET_HANDLER)
    .timeBased()
    .everyDays(1)
    .atHour(DAILY_RESULT_RESET_HOUR)
    .create();

  Logger.log("Installed daily market-result reset trigger for approximately 02:00 Asia/Kolkata.");
}

function removeDailyMarketResultResetTrigger() {
  const triggers = ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === DAILY_RESULT_RESET_HANDLER);
  triggers.forEach((trigger) => ScriptApp.deleteTrigger(trigger));
  Logger.log("Removed " + triggers.length + " daily market-result reset trigger(s).");
}

function buildDailyMarketResultResetPlan_() {
  const today = Utilities.formatDate(new Date(), DAILY_RESULT_RESET_TIME_ZONE, "yyyy-MM-dd");
  const yesterdayDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const yesterday = Utilities.formatDate(yesterdayDate, DAILY_RESULT_RESET_TIME_ZONE, "yyyy-MM-dd");
  const datesCleared = [yesterday, today];
  const dateSet = new Set(datesCleared);
  const updates = {};
  const counts = {
    legacyMarketsReset: 0,
    adminMarketsReset: 0,
    resultHistoryEntriesRemoved: 0,
    malformedLegacyMarketRecordsSkipped: 0,
  };

  for (const bucket of ["GAMES", "GAMES2", "GAMES3"]) {
    const games = dailyResultResetFirebaseRequest_("GET", bucket);
    if (!games || typeof games !== "object" || Array.isArray(games)) continue;

    for (const [key, rawGame] of Object.entries(games)) {
      if (key === "x" || rawGame === null || rawGame === undefined) continue;
      const result = resetLegacyMarketResult_(bucket, key, rawGame);
      if (result === false) {
        counts.malformedLegacyMarketRecordsSkipped += 1;
      } else if (result) {
        Object.assign(updates, result);
        counts.legacyMarketsReset += 1;
      }
    }
  }

  const markets = dailyResultResetFirebaseRequest_("GET", "adminData/markets");
  if (markets && typeof markets === "object" && !Array.isArray(markets)) {
    for (const [key, market] of Object.entries(markets)) {
      if (key === "x" || !market || typeof market !== "object" || Array.isArray(market)) continue;

      const path = dailyResultResetPath_("adminData", "markets", key);
      updates[path + "/result"] = DAILY_RESULT_RESET_PLACEHOLDER;
      updates[path + "/openResult"] = null;
      updates[path + "/closeResult"] = null;
      updates[path + "/resultDate"] = "";

      if (Array.isArray(market.results)) {
        const retainedResults = market.results.filter((item) =>
          !item || !dateSet.has(String(item.date || ""))
        );
        counts.resultHistoryEntriesRemoved += market.results.length - retainedResults.length;
        updates[path + "/results"] = retainedResults;
      }

      if (Array.isArray(market.legacyFields)) {
        const fields = market.legacyFields.slice();
        fields[6] = DAILY_RESULT_RESET_PLACEHOLDER;
        if (fields[8] !== undefined && fields[8] !== null) {
          fields[8] = dailyResultResetMetadata_(fields[8]);
        }
        updates[path + "/legacyFields"] = fields;
      }
      counts.adminMarketsReset += 1;
    }
  }

  const resultRoot = dailyResultResetFirebaseRequest_("GET", "Results");
  if (resultRoot && typeof resultRoot === "object" && !Array.isArray(resultRoot)) {
    for (const [marketKey, marketResults] of Object.entries(resultRoot)) {
      if (marketKey === "x" || !marketResults || typeof marketResults !== "object") continue;
      for (const date of datesCleared) {
        if (Object.prototype.hasOwnProperty.call(marketResults, date)) {
          updates[dailyResultResetPath_("Results", marketKey, date)] = null;
          counts.resultHistoryEntriesRemoved += 1;
        }
      }
    }
  }

  return { updates, counts, datesCleared };
}

function resetLegacyMarketResult_(bucket, key, rawGame) {
  const path = dailyResultResetPath_(bucket, key);
  if (typeof rawGame === "string") {
    if (!rawGame.trim().startsWith("[")) return null;

    let fields;
    try {
      fields = JSON.parse(rawGame);
    } catch (error) {
      return false;
    }
    if (!Array.isArray(fields)) return false;

    fields[6] = DAILY_RESULT_RESET_PLACEHOLDER;
    if (fields[8] !== undefined && fields[8] !== null) {
      fields[8] = dailyResultResetMetadata_(fields[8]);
    }
    return { [path]: JSON.stringify(fields) };
  }

  if (!rawGame || typeof rawGame !== "object" || Array.isArray(rawGame)) return null;
  const updates = {};
  if (Object.prototype.hasOwnProperty.call(rawGame, "result")) {
    updates[path + "/result"] = DAILY_RESULT_RESET_PLACEHOLDER;
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

function dailyResultResetMetadata_(value) {
  let metadata;
  if (typeof value === "string") {
    if (!value.trim()) return value;
    try {
      metadata = JSON.parse(value);
    } catch (error) {
      throw new Error("Invalid market metadata in daily result reset: " + error.message);
    }
  } else {
    metadata = value;
  }
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new Error("Expected market metadata to be an object.");
  }
  metadata = Object.assign({}, metadata, { resultDate: "" });
  return typeof value === "string" ? JSON.stringify(metadata) : metadata;
}

function dailyResultResetPath_() {
  return Array.prototype.slice.call(arguments).map((part) => {
    const value = String(part);
    if (!value || /[.#$\[\]/]/.test(value)) {
      throw new Error("Invalid Firebase path segment: " + value);
    }
    return value;
  }).join("/");
}

function dailyResultResetFirebaseRequest_(method, path, payload) {
  const properties = PropertiesService.getScriptProperties();
  const email = String(properties.getProperty("FIREBASE_SERVICE_ACCOUNT_EMAIL") || "").trim();
  const privateKey = String(properties.getProperty("FIREBASE_PRIVATE_KEY") || "")
    .replace(/\\n/g, "\n").trim();
  if (!email || !privateKey) {
    throw new Error("Set FIREBASE_SERVICE_ACCOUNT_EMAIL and FIREBASE_PRIVATE_KEY in Script Properties.");
  }
  if (!/^[^@\s]+@[^@\s]+\.iam\.gserviceaccount\.com$/.test(email)) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_EMAIL must be a service-account email ending in .iam.gserviceaccount.com.");
  }
  if (!/^-----BEGIN (?:RSA )?PRIVATE KEY-----[\s\S]+-----END (?:RSA )?PRIVATE KEY-----$/.test(privateKey)) {
    throw new Error("FIREBASE_PRIVATE_KEY must be the complete PEM private_key from the service-account JSON file.");
  }

  const host = DAILY_RESULT_RESET_DATABASE_URL.replace(/^https:\/\//, "").replace(/\/+$/, "");
  if (host !== DAILY_RESULT_RESET_DATABASE_HOST) {
    throw new Error("Daily reset is restricted to the Sridevi Matka primary Realtime Database.");
  }

  const token = dailyResultResetAccessToken_(email, privateKey);
  const encodedPath = path ? path.split("/").map(encodeURIComponent).join("/") : "";
  const url = DAILY_RESULT_RESET_DATABASE_URL + "/" + encodedPath + ".json";
  const options = {
    method: method.toLowerCase(),
    contentType: "application/json",
    headers: { Authorization: "Bearer " + token },
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

function dailyResultResetAccessToken_(email, privateKey) {
  const cache = CacheService.getScriptCache();
  const cached = cache.get("daily-market-result-reset-access-token");
  if (cached) return cached;

  const issuedAt = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: email,
    scope: "https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email",
    aud: "https://oauth2.googleapis.com/token",
    iat: issuedAt,
    exp: issuedAt + 3600,
  };
  const unsignedToken = dailyResultResetBase64WebSafe_(JSON.stringify(header)) + "."
    + dailyResultResetBase64WebSafe_(JSON.stringify(claims));
  let signature;
  try {
    signature = Utilities.computeRsaSha256Signature(unsignedToken, privateKey);
  } catch (error) {
    throw new Error("Could not sign the Firebase token. Check the complete service-account private key. Details: " + error.message);
  }

  const assertion = unsignedToken + "." + dailyResultResetBase64WebSafe_(signature);
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
  cache.put("daily-market-result-reset-access-token", tokenResponse.access_token, 3000);
  return tokenResponse.access_token;
}

function dailyResultResetBase64WebSafe_(value) {
  return Utilities.base64EncodeWebSafe(value).replace(/=+$/, "");
}
