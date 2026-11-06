const FIREBASE_DATABASE_URL =
  "https://a2morning-in-website-new-db-default-rtdb.firebaseio.com";
const MARKET_BUCKETS = ["GAMES", "GAMES2", "GAMES3"];
const RESET_TIME_ZONE = "Asia/Kolkata";
const RESET_RESULT = "### - ## - ###";
const RESET_RESULT_TWO_PART = "### - #";
const LAST_RESET_PROPERTY = "A2MORNING_LAST_DAILY_RESET";

function installNightlyMarketResetTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === "resetNightlyMarketResults") {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger("resetNightlyMarketResults")
    .timeBased()
    .atHour(5)
    .everyDays(1)
    .inTimezone(RESET_TIME_ZONE)
    .create();

  Logger.log("Installed daily market reset trigger between 5 AM and 6 AM India time.");
}

function installMinuteFirebaseUpdateTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (["updateFirebaseDateAndTime", "updateFirebaseDateAndMarkets"]
      .indexOf(trigger.getHandlerFunction()) !== -1) {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger("updateFirebaseDateAndTime")
    .timeBased()
    .everyMinutes(1)
    .create();

  updateFirebaseDateAndTime();
  Logger.log("Installed Firebase date and time update trigger to run every minute.");
}

function removeMinuteFirebaseUpdateTrigger() {
  const handlerNames = ["updateFirebaseDateAndTime", "updateFirebaseDateAndMarkets"];
  const triggers = ScriptApp.getProjectTriggers().filter(function (trigger) {
    return handlerNames.indexOf(trigger.getHandlerFunction()) !== -1;
  });
  triggers.forEach(function (trigger) {
    ScriptApp.deleteTrigger(trigger);
  });
  Logger.log("Removed " + triggers.length + " Firebase date and time update trigger(s).");
}

function updateFirebaseDateAndTime() {
  const now = new Date();
  const expected = {
    date: Utilities.formatDate(now, RESET_TIME_ZONE, "dd-MM-yyyy HH:mm:ss"),
    time: Utilities.formatDate(now, RESET_TIME_ZONE, "hh:mm:ss a"),
    day: Utilities.formatDate(now, RESET_TIME_ZONE, "EEEE")
  };

  firebasePatch_("Date", expected);

  const saved = decodeFirebaseValue_(firebaseGet_("Date").data);
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) {
    throw new Error("Firebase Date write returned success, but Date could not be read back.");
  }
  Object.keys(expected).forEach(function (key) {
    const actual = String(decodeFirebaseValue_(saved[key]) || "");
    if (actual !== expected[key]) {
      throw new Error(
        "Firebase Date verification failed for " + key +
        ". Expected " + expected[key] + ", received " + actual + "."
      );
    }
  });
  Logger.log("Firebase Date verified successfully: %s", JSON.stringify(saved));
}

function resetNightlyMarketResults(event) {
  if (!event || !event.triggerUid) {
    installNightlyMarketResetTrigger();
    Logger.log(
      "Manual run detected. Installed the morning trigger; Firebase data was not changed."
    );
    return;
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    throw new Error("A daily market reset is already running.");
  }

  try {
    const date = Utilities.formatDate(new Date(), RESET_TIME_ZONE, "dd-MM-yyyy");
    const properties = PropertiesService.getScriptProperties();
    if (properties.getProperty(LAST_RESET_PROPERTY) === date) {
      Logger.log("Daily reset already completed for %s.", date);
      return;
    }

    const markets = [];
    MARKET_BUCKETS.forEach(function (bucket) {
      markets.push.apply(markets, resetMarketBucket_(bucket));
    });
    resetAdminMarketResults_();
    resetDailyMarketData_(date, markets);
    initializeDailyTotals_(date);

    const dailyBalance = sumUserBalances_(firebaseGet_("DATA").data);
    firebasePut_("Daily Total Money/" + date, dailyBalance);

    aggregateDailyAmountHistory_("Total Added Money");
    aggregateDailyAmountHistory_("Total Withdrawl Money");
    aggregateFinalAmounts_();

    properties.setProperty(LAST_RESET_PROPERTY, date);
    Logger.log(
      "Daily reset completed for %s. Markets reset: %s.",
      date,
      markets.length
    );
  } finally {
    lock.releaseLock();
  }
}

function resetMarketBucket_(bucket) {
  const response = firebaseGet_(bucket, true);
  const records = decodeFirebaseValue_(response.data);
  if (!records || typeof records !== "object" || Array.isArray(records)) {
    throw new Error("Firebase market bucket " + bucket + " is missing or invalid.");
  }

  const updates = {};
  const markets = [];
  Object.keys(records).forEach(function (id) {
    if (id === "x" || records[id] === null) return;

    const rawRecord = records[id];
    const record = decodeFirebaseValue_(rawRecord);
    if (!Array.isArray(record) || !record[0] || record.length < 7) {
      throw new Error("Invalid market record at " + bucket + "/" + id + ".");
    }

    const marketName = String(record[0]).trim();
    assertFirebaseKey_(marketName);
    record[6] = String(record[7]) === "2" ? RESET_RESULT_TWO_PART : RESET_RESULT;
    const metadata = decodeFirebaseValue_(record[8]);
    if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
      metadata.resultDate = "";
      record[8] = JSON.stringify(metadata);
    }

    updates[id] = typeof rawRecord === "string" ? JSON.stringify(record) : record;
    markets.push(marketName);
  });

  if (!markets.length) {
    throw new Error("No markets were found in Firebase bucket " + bucket + ".");
  }
  firebasePatch_(bucket, updates, response.etag);
  return markets;
}

function resetAdminMarketResults_() {
  const response = firebaseGet_("adminData/markets", true);
  if (response.data === null || response.data === undefined) return;

  const markets = decodeFirebaseValue_(response.data);
  if (!Array.isArray(markets) && (!markets || typeof markets !== "object")) {
    throw new Error("Firebase adminData/markets must contain a market list.");
  }

  const resetMarket = function (market) {
    if (!market || typeof market !== "object" || Array.isArray(market)) return market;
    const legacyFields = Array.isArray(market.legacyFields) ? market.legacyFields : [];
    const isTwoPart = String(legacyFields[7] || "") === "2"
      || /starline/i.test(String(market.name || ""));
    const placeholder = isTwoPart ? RESET_RESULT_TWO_PART : RESET_RESULT;
    const updated = Object.assign({}, market, {
      result: placeholder,
      resultDate: ""
    });
    delete updated.openResult;
    delete updated.closeResult;

    if (Array.isArray(market.legacyFields)) {
      updated.legacyFields = market.legacyFields.slice();
      updated.legacyFields[6] = placeholder;
      const metadata = decodeFirebaseValue_(updated.legacyFields[8]);
      if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
        metadata.resultDate = "";
        updated.legacyFields[8] = JSON.stringify(metadata);
      }
    }
    return updated;
  };

  const updatedMarkets = Array.isArray(markets)
    ? markets.map(resetMarket)
    : Object.keys(markets).reduce(function (result, id) {
      result[id] = resetMarket(markets[id]);
      return result;
    }, {});
  const value = typeof response.data === "string"
    ? JSON.stringify(updatedMarkets)
    : updatedMarkets;
  firebasePut_("adminData/markets", value, response.etag);
}

function resetDailyMarketData_(date, markets) {
  const uniqueMarkets = Array.from(new Set(markets));
  const finalAmounts = { x: "x" };
  const openWins = { x: "x" };
  const closeWins = { x: "x" };
  const players = { x: "x" };

  uniqueMarkets.forEach(function (market) {
    assertFirebaseKey_(market);
    finalAmounts[market] = "[]";
    openWins[market] = "0";
    closeWins[market] = "0";
    players[market] = {
      Open: { x: "x" },
      Close: { x: "x" }
    };
  });

  firebasePatch_("Players", { x: "x" });
  firebasePut_("Final Amount/" + date, finalAmounts);
  firebasePut_("Win Amount/" + date + "/Open", openWins);
  firebasePut_("Win Amount/" + date + "/Close", closeWins);
  firebasePut_("Players/" + date, players);
}

function initializeDailyTotals_(date) {
  firebasePatch_("New Users", { x: "x" });
  firebasePatch_("Total Added Money", { x: "x" });
  firebasePatch_("Total Withdrawl Money", { x: "x" });
  firebasePatch_("Today Added Money", { x: "x" });
  firebasePatch_("Today Winners", { x: "x" });
  firebasePatch_("Today Withdrawn Money", { x: "x" });

  firebasePut_("Total Added Money/" + date, "[]");
  firebasePut_("Total Withdrawl Money/" + date, "[]");
  firebasePut_("Today Added Money/" + date, { x: "x" });
  firebasePut_("Today Winners/" + date, { x: "x" });
  firebasePut_("Today Withdrawn Money/" + date, { x: "x" });
}

function sumUserBalances_(rawUsers) {
  const users = decodeFirebaseValue_(rawUsers);
  if (users === null || users === undefined) return 0;
  if (typeof users !== "object" || Array.isArray(users)) {
    throw new Error("Firebase DATA must contain a user object.");
  }

  return Object.keys(users).reduce(function (total, phone) {
    if (phone === "x" || users[phone] === null) return total;
    const profile = decodeFirebaseValue_(users[phone]);
    if (!profile || typeof profile !== "object" || profile.bal === null || profile.bal === undefined) {
      return total;
    }

    const balance = Number(decodeFirebaseValue_(profile.bal));
    if (!Number.isFinite(balance)) {
      throw new Error("Invalid balance found under DATA/" + phone + "/bal.");
    }
    return total + balance;
  }, 0);
}

function aggregateDailyAmountHistory_(path) {
  const history = decodeFirebaseValue_(firebaseGet_(path).data);
  if (history === null || history === undefined) return;
  if (typeof history !== "object" || Array.isArray(history)) {
    throw new Error("Firebase " + path + " must contain a date-keyed object.");
  }

  const updates = { x: "x" };
  Object.keys(history).forEach(function (date) {
    if (date === "x") return;
    const amounts = decodeFirebaseValue_(history[date]);
    if (!Array.isArray(amounts)) {
      throw new Error("Invalid amount list at " + path + "/" + date + ".");
    }
    if (amounts.length) {
      updates[date] = JSON.stringify([sumAmounts_(amounts, path + "/" + date)]);
    }
  });
  firebasePatch_(path, updates);
}

function aggregateFinalAmounts_() {
  const finalAmounts = decodeFirebaseValue_(firebaseGet_("Final Amount").data);
  if (finalAmounts === null || finalAmounts === undefined) return;
  if (typeof finalAmounts !== "object" || Array.isArray(finalAmounts)) {
    throw new Error("Firebase Final Amount must contain a date-keyed object.");
  }

  Object.keys(finalAmounts).forEach(function (date) {
    if (date === "x") return;
    const day = decodeFirebaseValue_(finalAmounts[date]);
    if (!day || typeof day !== "object" || Array.isArray(day)) {
      throw new Error("Invalid market totals at Final Amount/" + date + ".");
    }

    const updates = { x: "x" };
    Object.keys(day).forEach(function (market) {
      if (market === "x") return;
      const amounts = decodeFirebaseValue_(day[market]);
      if (!Array.isArray(amounts)) {
        throw new Error("Invalid amount list at Final Amount/" + date + "/" + market + ".");
      }
      if (amounts.length) {
        updates[market] = JSON.stringify([
          sumAmounts_(amounts, "Final Amount/" + date + "/" + market)
        ]);
      }
    });
    firebasePatch_("Final Amount/" + date, updates);
  });
}

function sumAmounts_(amounts, path) {
  return amounts.reduce(function (total, rawAmount, index) {
    const amount = Number(decodeFirebaseValue_(rawAmount));
    if (!Number.isFinite(amount)) {
      throw new Error("Invalid amount at " + path + "[" + index + "].");
    }
    return total + amount;
  }, 0);
}

function decodeFirebaseValue_(value) {
  let decoded = value;
  for (let depth = 0; depth < 2 && typeof decoded === "string"; depth += 1) {
    try {
      const parsed = JSON.parse(decoded);
      if (parsed === decoded) break;
      decoded = parsed;
    } catch (error) {
      break;
    }
  }
  return decoded;
}

function assertFirebaseKey_(key) {
  if (!key || /[.#$/\[\]\u0000-\u001f\u007f]/.test(key)) {
    throw new Error("Invalid Firebase market name: " + key);
  }
}

function firebaseGet_(path, includeEtag) {
  const options = {
    method: "get",
    muteHttpExceptions: true
  };
  if (includeEtag) options.headers = { "X-Firebase-ETag": "true" };

  const response = UrlFetchApp.fetch(firebaseUrl_(path), options);
  assertSuccessfulResponse_(response, "read " + (path || "database root"));
  const body = response.getContentText();
  return {
    data: body ? JSON.parse(body) : null,
    etag: includeEtag ? findHeader_(response.getHeaders(), "etag") : ""
  };
}

function firebasePut_(path, value, etag) {
  firebaseWrite_("put", path, value, etag);
}

function firebasePatch_(path, value, etag) {
  firebaseWrite_("patch", path, value, etag);
}

function firebaseWrite_(method, path, value, etag) {
  const headers = {};
  if (etag) headers["If-Match"] = etag;
  const response = UrlFetchApp.fetch(firebaseUrl_(path, true), {
    method: method,
    contentType: "application/json",
    headers: headers,
    payload: JSON.stringify(value),
    muteHttpExceptions: true
  });
  assertSuccessfulResponse_(response, method.toUpperCase() + " " + (path || "database root"));
}

function firebaseUrl_(path, silent) {
  const root = FIREBASE_DATABASE_URL.replace(/\/+$/, "");
  const encodedPath = path
    ? "/" + path.split("/").map(encodeURIComponent).join("/")
    : "";
  const query = [];
  if (silent) query.push("print=silent");

  const token = String(
    PropertiesService.getScriptProperties()
      .getProperty("FIREBASE_DATABASE_AUTH_TOKEN") || ""
  ).trim();
  if (token) query.push("auth=" + encodeURIComponent(token));

  return root + encodedPath + ".json" + (query.length ? "?" + query.join("&") : "");
}

function findHeader_(headers, name) {
  const target = name.toLowerCase();
  const key = Object.keys(headers).find(function (headerName) {
    return headerName.toLowerCase() === target;
  });
  if (!key) return "";
  const value = headers[key];
  return Array.isArray(value) ? value[0] : value;
}

function assertSuccessfulResponse_(response, action) {
  const status = response.getResponseCode();
  if (status < 200 || status >= 300) {
    throw new Error(
      "Firebase could not " + action + " (HTTP " + status + "): " +
      response.getContentText()
    );
  }
}
