const firebaseConfig = {
  apiKey: "AIzaSyDVZEqp2CKsKOWKv21_dUL9r-SbyOJPS4Q",
  authDomain: "kalyan-gold-app.firebaseapp.com",
  databaseURL: "https://kalyan-gold-app-default-rtdb.firebaseio.com",
  projectId: "kalyan-gold-app",
  storageBucket: "kalyan-gold-app.firebasestorage.app",
  messagingSenderId: "838908612415",
  appId: "1:838908612415:web:dfc6ebc1b2f789cd2b8d8a",
  measurementId: "G-P8V3K5QK91"
};
const DEFAULT_WEBSITE_URL = "https://mama567.bond";

if (window.firebase && !firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const DATABASE_ROOTS = {
  users: "DATA",
  marketBuckets: ["GAMES", "GAMES2", "GAMES3"],
  notices: "Notice/Notice",
  rates: "Rate Chart",
  settings: "Admin/Admin",
  bidRecords: "Normal T Data",
  bidHistory: "Normal T Data2",
  deposits: "DR",
  withdrawals: "WR"
};

const GAME_TYPES = [
  "Single", "Jodi", "Bulk Jodi", "Single Pana", "Double Pana",
  "Triple Pana", "SP Motor", "DP Motor", "TP Motor", "SP DP TP",
  "Half Sangam", "Full Sangam"
];
const GAME_ART = {
  "Single": "game-single.jpg",
  "Jodi": "game-jodi.jpg",
  "Bulk Jodi": "game-bulk-jodi.jpg",
  "Single Pana": "game-single-pana.jpg",
  "Double Pana": "game-double-pana.jpg",
  "Triple Pana": "game-triple-pana.jpg",
  "SP Motor": "game-sp-motor.jpg",
  "DP Motor": "game-dp-motor.jpg",
  "TP Motor": "game-tp-motor.jpg",
  "SP DP TP": "game-sp-dp-tp.jpg",
  "Half Sangam": "game-half-sangam.jpg",
  "Full Sangam": "game-full-sangam.jpg"
};
const MARKET_CATEGORIES = ["Main", "Starline", "Gali / Disawar"];
const state = {
  authMode: "signup",
  user: null,
  page: "home",
  balance: 0,
  balancePath: "",
  markets: [],
  marketLoadError: "",
  signUpBonus: 0,
  category: "Main",
  selectedGame: "Single",
  selectedMarket: "",
  selectedSession: "Open",
  betDraft: [],
  bids: [],
  pointsHistory: [],
  depositHistory: [],
  withdrawalHistory: [],
  rates: null,
  notices: [],
  policy: "",
  websiteUrl: "",
  resultChartUrl: "",
  webViewerUrl: "",
  webViewerTitle: "",
  contactUrl: "",
  telegramUrl: "",
  marketDay: "",
  marketBucket: "",
  marketTimestamp: null,
  marketTimestampReceivedAt: 0
};
const realtimeSources = new Map();
const realtimeTimers = new Map();
const realtimeValues = new Map();
let marketDayTimer = 0;
let realtimeUserPhone = "";
let activeMarketBucket = "";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const money = amount => `₹ ${Number(amount || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const safeText = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[char]);
const dateText = value => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";
};
const phonePath = phone => encodeURIComponent(phone);

function dbUrl(path = "") {
  const clean = path.split("/").filter(Boolean).map(encodeURIComponent).join("/");
  return `${firebaseConfig.databaseURL.replace(/\/+$/, "")}/${clean}.json`;
}

function userHistoryRecords(data, bidRecords) {
  const decoded = decodeFirebaseObject(data);
  if (!decoded || typeof decoded !== "object") return [];
  const detailsByKey = new Map();
  const decodedBidRecords = decodeFirebaseObject(bidRecords);
  for (const [date, records] of Object.entries(decodedBidRecords || {})) {
    if (date === "x" || !records || typeof records !== "object") continue;
    for (const [tag, rawValue] of Object.entries(records)) {
      const detail = decodeFirebaseValue(rawValue);
      let payload = detail;
      if (typeof detail === "string") {
        try {
          payload = JSON.parse(detail);
        } catch {
          payload = detail;
        }
      }
      const parts = tag.split("&");
      if (parts.length >= 4) {
        detailsByKey.set(`${date}|${parts[1]}|${parts[2]}`, {
          market: parts[parts.length - 1].split(" : ")[0],
          payload
        });
      }
    }
  }
  const records = [];
  for (const [date, entries] of Object.entries(decoded)) {
    if (date === "x" || !entries || typeof entries !== "object") continue;
    for (const [historyTag, rawValue] of Object.entries(entries)) {
      if (historyTag === "x") continue;
      const value = decodeFirebaseValue(rawValue);
      const parsed = parseLegacyHistoryTag(String(value)) || parseLegacyHistoryTag(historyTag);
      if (!parsed) continue;
      const details = parsed ? detailsByKey.get(`${date}|${parsed.time}|${parsed.selection}`) : null;
      const payload = details?.payload;
      records.push({
        id: `${date}/${historyTag}`,
        date,
        tag: historyTag,
        value,
        payload,
        title: details?.market || "Bid",
        market: details?.market || "",
        gameType: Array.isArray(payload) ? payload[0] : "",
        selection: parsed?.selection || "",
        createdAt: parseLegacyDate(`${date}&${parsed?.time || "00:00:00"}`, date),
        amount: parsed?.amount,
        status: "Recorded"
      });
    }
  }
  return records.sort((left, right) => right.id.localeCompare(left.id));
}

function parseLegacyHistoryTag(tag) {
  const match = tag.match(/^(\d{2}-\d{2}-\d{4}) (\d{1,2}:\d{2}:\d{2}(?:\s+[AP]M)?):([^:]+):"([^"]*)"$/i);
  if (!match) return null;
  const amount = Number(match[3]);
  return {
    time: match[2],
    amount: Number.isFinite(amount) ? amount : undefined,
    selection: match[4]
  };
}

function parseLegacyDate(tag, date) {
  const match = tag.match(/^(\d{2})-(\d{2})-(\d{4})&(\d{1,2}):(\d{2}):(\d{2})(?:\s*(AM|PM))?/i);
  if (match) {
    let hour = Number(match[4]);
    if (match[7]) {
      hour %= 12;
      if (match[7].toUpperCase() === "PM") hour += 12;
    }
    return `${match[3]}-${match[2]}-${match[1]}T${String(hour).padStart(2, "0")}:${match[5]}:${match[6]}`;
  }
  const day = date.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  return day ? `${day[3]}-${day[2]}-${day[1]}` : date;
}

async function dbRequest(method, path, body) {
  const options = { method, headers: {} };
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12_000);
  options.signal = controller.signal;
  if (body !== undefined) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }
  try {
    const response = await fetch(dbUrl(path), options);
    const raw = await response.text();
    let data = null;
    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error("Firebase returned an unreadable response.");
      }
    }
    if (!response.ok) {
      const reason = data && (data.error || data.message);
      const message = reason ? String(reason) : `HTTP ${response.status}`;
      throw new Error(`Firebase ${method} ${path || "/"} failed (${response.status}): ${message}`);
    }
    return data;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`Firebase ${method} ${path || "/"} timed out after 12 seconds. Check your connection and try again.`);
    }
    if (error instanceof Error && error.message.startsWith("Firebase ")) throw error;
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Firebase ${method} ${path || "/"} failed to connect: ${reason}`);
  } finally {
    window.clearTimeout(timeout);
  }
}

const dbGet = path => dbRequest("GET", path);
const dbPut = (path, data) => dbRequest("PUT", path, data);
const dbPatch = (path, data) => dbRequest("PATCH", path, data);
const dbPost = (path, data) => dbRequest("POST", path, data);

function comparableFirebaseValue(value) {
  value = decodeFirebaseValue(value);
  if (Array.isArray(value)) return value.map(comparableFirebaseValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, comparableFirebaseValue(value[key])]));
  }
  return value;
}

async function dbPutAndVerify(path, value) {
  await dbPut(path, value);
  const saved = await dbGet(path);
  if (JSON.stringify(comparableFirebaseValue(saved)) !== JSON.stringify(comparableFirebaseValue(value))) {
    throw new Error(`Firebase did not save the expected value at ${path}. Check the database path and write permission.`);
  }
}

async function dbPatchAndVerify(updates) {
  try {
    await dbPatch("", updates);
  } catch (error) {
    if (/permission denied|unauthorized|forbidden/i.test(error.message)) {
      const paths = Object.keys(updates).map(path => path.replace(/\/\d{10}(?=\/|$)/g, "/<phone>"));
      throw new Error(`Firebase denied this multi-path write. It requires write permission for: ${paths.join(", ")}. Check the published Realtime Database rules for this project. The website cannot override Firebase rules.`);
    }
    throw error;
  }
  const verification = await Promise.all(Object.entries(updates).map(async ([path, expected]) => {
    const saved = await dbGet(path);
    const matches = JSON.stringify(comparableFirebaseValue(saved)) === JSON.stringify(comparableFirebaseValue(expected));
    return { path, matches };
  }));
  const failed = verification.filter(item => !item.matches);
  if (failed.length) {
    throw new Error(`Firebase did not confirm saving: ${failed.map(item => item.path).join(", ")}. Check database paths and write permissions.`);
  }
}

function notify(message, kind = "success") {
  const toast = document.createElement("div");
  toast.className = `toast ${kind === "error" ? "error" : ""}`;
  toast.textContent = message;
  $("#toast-region").append(toast);
  window.setTimeout(() => toast.remove(), 4300);
}

function setInlineMessage(id, message, success = false) {
  const element = $(`#${id}`);
  if (!element) return;
  element.textContent = message;
  element.classList.toggle("success", success);
}

function setBusy(button, busy, busyText = "Please wait…") {
  if (!button) return;
  if (busy) {
    button.dataset.originalText = button.innerHTML;
    button.disabled = true;
    button.textContent = busyText;
  } else {
    button.disabled = false;
    if (button.dataset.originalText) button.innerHTML = button.dataset.originalText;
  }
}

function decodeFirebaseValue(value) {
  let decoded = value;
  for (let depth = 0; depth < 2 && typeof decoded === "string"; depth += 1) {
    try {
      const parsed = JSON.parse(decoded);
      if (parsed === decoded) break;
      decoded = parsed;
    } catch {
      break;
    }
  }
  return decoded;
}

function decodeFirebaseObject(value) {
  const decoded = decodeFirebaseValue(value);
  if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) return decoded;
  return Object.fromEntries(Object.entries(decoded).map(([key, item]) => [key, decodeFirebaseValue(item)]));
}

function showAuth(mode = "signup") {
  state.authMode = mode;
  $("#auth-view").classList.remove("hidden");
  $("#app-view").classList.add("hidden");
  $("#auth-form").reset();
  $("#name-field").classList.toggle("hidden", mode !== "signup");
  $("#auth-name").required = mode === "signup";
  $("#auth-password").autocomplete = mode === "signup" ? "new-password" : "current-password";
  $("#auth-whatsapp-button").classList.toggle("hidden", mode !== "signup");
  $("#forgot-password-button").classList.toggle("hidden", mode !== "login");
  $("#auth-eyebrow").textContent = mode === "signup" ? "GET STARTED" : "YOUR ACCOUNT";
  $("#auth-title").textContent = mode === "signup" ? "Create your account" : "Welcome back";
  $("#auth-subtitle").textContent = mode === "signup"
    ? "Enter your details to set up your Kalyan Gold account."
    : "Sign in with your phone number and password.";
  $("#auth-submit").innerHTML = mode === "signup" ? "Create account <span aria-hidden=\"true\">→</span>" : "Sign in <span aria-hidden=\"true\">→</span>";
  $$(".auth-tab").forEach(tab => tab.classList.toggle("active", tab.dataset.authMode === mode));
}

function openWhatsApp(message = "") {
  const configured = String(decodeFirebaseValue(state.contactUrl) || "").trim();
  if (!configured) throw new Error("A WhatsApp contact link has not been configured.");
  let contact;
  try {
    contact = new URL(configured);
  } catch {
    throw new Error("The configured WhatsApp contact link is invalid.");
  }
  if (!["https:", "http:"].includes(contact.protocol)) {
    throw new Error("The configured WhatsApp contact link is not valid.");
  }
  const number = contact.pathname.match(/(?:send\/)?(\d{8,15})/)?.[1] ||
    contact.searchParams.get("phone")?.replace(/\D/g, "");
  if (!number) throw new Error("The configured WhatsApp contact link does not contain a phone number.");
  const url = new URL(`https://wa.me/${number}`);
  if (message) url.searchParams.set("text", message);
  openExternalUrl(url.href, "WhatsApp");
}

function safeExternalUrl(value, label) {
  let raw = String(decodeFirebaseValue(value) || "").trim();
  if (!raw) throw new Error(`A ${label} link has not been configured.`);
  if (!/^[a-z][a-z\d+.-]*:/i.test(raw)) raw = `https://${raw.replace(/^\/+/, "")}`;
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`The configured ${label} link is invalid.`);
  }
  if (!["https:", "http:"].includes(url.protocol)) {
    throw new Error(`The configured ${label} link is not valid.`);
  }
  return url.href;
}

function openResultsWebsite() {
  state.webViewerTitle = "Results";
  state.webViewerUrl = safeExternalUrl(state.websiteUrl || DEFAULT_WEBSITE_URL, "website");
  setPage("webviewer");
}

function marketResultUrl(marketName) {
  const template = String(decodeFirebaseValue(state.resultChartUrl) || "").trim() || DEFAULT_WEBSITE_URL;
  if (!template) throw new Error("A market result website has not been configured.");
  let url;
  try {
    url = new URL(/^[a-z][a-z\d+.-]*:/i.test(template) ? template : `https://${template.replace(/^\/+/, "")}`);
  } catch {
    throw new Error("The configured market result website link is invalid.");
  }
  if (!["https:", "http:"].includes(url.protocol)) {
    throw new Error("The configured market result website link is not valid.");
  }
  const existingMarketParameter = [...url.searchParams.keys()].find(key => /market|result/i.test(key));
  url.searchParams.set(existingMarketParameter || "market", marketName);
  return url.href;
}

function openMarketResult(marketName) {
  state.webViewerTitle = `${marketName} result`;
  state.webViewerUrl = marketResultUrl(marketName);
  setPage("webviewer");
}

function openExternalUrl(value, label) {
  const url = safeExternalUrl(value, label);
  const opened = window.open(url, "_blank");
  if (!opened) throw new Error(`The ${label} link was blocked by your browser.`);
  opened.opener = null;
}

function applyAdminSettings(value) {
  const settings = decodeFirebaseObject(value) || {};
  state.signUpBonus = Number(decodeFirebaseValue(settings["Sign Up Bonus"]) || 0);
  const policy = decodeFirebaseValue(settings.Policy);
  state.policy = Array.isArray(policy) ? policy.join("\n\n") : String(policy || "");
  state.websiteUrl = String(decodeFirebaseValue(settings.Website) || "").trim() || DEFAULT_WEBSITE_URL;
  state.contactUrl = String(decodeFirebaseValue(settings.Contact) || "").trim();
  state.telegramUrl = String(
    decodeFirebaseValue(settings.Telegram) ||
    decodeFirebaseValue(settings.TG) ||
    ""
  ).trim();
  state.resultChartUrl = String(decodeFirebaseValue(settings["Market_Reult_chart_Web"]) || "").trim();
}

async function loadAdminSettings() {
  applyAdminSettings(await dbGet(DATABASE_ROOTS.settings));
}

async function submitAuth(event) {
  event.preventDefault();
  const button = $("#auth-submit");
  const phone = $("#auth-phone").value.replace(/\D/g, "");
  const password = $("#auth-password").value;
  const name = $("#auth-name").value.trim();
  if (!/^\d{10}$/.test(phone)) {
    notify("Enter a valid 10-digit phone number.", "error");
    return;
  }
  if (password.length < 8) {
    notify("Password must be at least 8 characters.", "error");
    return;
  }
  if (state.authMode === "signup" && name.length < 2) {
    notify("Enter your name to create an account.", "error");
    return;
  }

  setBusy(button, true, state.authMode === "signup" ? "Creating account…" : "Signing in…");
  try {
    const recordPath = `${DATABASE_ROOTS.users}/${phone}`;
    const record = decodeFirebaseObject(await dbGet(recordPath));
    if (state.authMode === "signup") {
      if (record) throw new Error("An account with this phone number already exists.");
      const bonus = await dbGet(`${DATABASE_ROOTS.settings}/Sign Up Bonus`);
      state.signUpBonus = Number(decodeFirebaseValue(bonus) || 0);
      await dbPutAndVerify(recordPath, {
        name: JSON.stringify(name),
        password: JSON.stringify(password),
        bal: state.signUpBonus,
        B2: "0",
        TD: "0",
        TW: "0",
        push: ""
      });
      state.user = { phone, name };
      localStorage.setItem("kalyanGoldUser", JSON.stringify(state.user));
      await enterApp();
      notify("Your account is ready.");
      return;
    }

    if (!record || typeof record !== "object" || String(record.password ?? "") !== password) {
      throw new Error("Phone number or password is incorrect.");
    }
    state.user = { phone, name: String(record.name || "Player") };
    localStorage.setItem("kalyanGoldUser", JSON.stringify(state.user));
    await enterApp();
    notify(`Welcome back, ${state.user.name}.`);
  } catch (error) {
    notify(error.message || "Unable to access your account.", "error");
  } finally {
    setBusy(button, false);
  }
}

function restoreSession() {
  try {
    const user = JSON.parse(localStorage.getItem("kalyanGoldUser") || "null");
    if (user && /^\d{10}$/.test(user.phone) && typeof user.name === "string") {
      state.user = user;
      return true;
    }
  } catch {
    localStorage.removeItem("kalyanGoldUser");
  }
  return false;
}

function getSharedSessionFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const name = String(params.get("name") || params.get("fullname") || params.get("user") || "").trim();
  const rawPhone = params.get("phone") || params.get("mobile") || params.get("number") || "";
  const coinValue = params.get("coin") || params.get("coins") || params.get("balance") || "";
  const phone = String(rawPhone).replace(/\D/g, "");
  if (!name || !/^\d{10}$/.test(phone) || !coinValue.trim()) {
    return null;
  }
  return {
    phone,
    name,
    coin: String(coinValue).trim()
  };
}

function logout() {
  stopRealtimeSubscriptions();
  state.user = null;
  state.page = "home";
  state.balance = 0;
  state.balancePath = "";
  state.bids = [];
  state.pointsHistory = [];
  state.depositHistory = [];
  state.withdrawalHistory = [];
  localStorage.removeItem("kalyanGoldUser");
  showAuth("login");
  $("#sidebar").classList.remove("open");
}

async function enterApp() {
  stopRealtimeSubscriptions();
  state.page = "home";
  state.balance = 0;
  state.balancePath = "";
  state.bids = [];
  state.pointsHistory = [];
  state.depositHistory = [];
  state.withdrawalHistory = [];
  $("#auth-view").classList.add("hidden");
  $("#app-view").classList.remove("hidden");
  $("#current-year").textContent = new Date().getFullYear();
  $("#header-name").textContent = state.user.name;
  $("#header-avatar").textContent = state.user.name.trim().charAt(0).toUpperCase() || "K";
  await renderPage();
  startRealtimeSubscriptions();
  const phone = state.user.phone;
  void Promise.allSettled([refreshUserData(), loadGlobalData()]).then(async outcomes => {
    if (!state.user || state.user.phone !== phone) return;
    for (const outcome of outcomes) {
      if (outcome.status === "rejected") {
        notify(outcome.reason?.message || "Could not load app data from Firebase.", "error");
      }
    }
    syncMarketBucketSubscription();
    await renderPage();
  });
}

async function refreshUserData() {
  if (!state.user) return;
  const phoneNumber = state.user.phone;
  const phone = phonePath(phoneNumber);
  const profilePath = `${DATABASE_ROOTS.users}/${phone}`;
  const profile = decodeFirebaseObject(await dbGet(profilePath));
  if (!state.user || state.user.phone !== phoneNumber) return;
  if (profile && profile.name && profile.name !== state.user.name) {
    state.user.name = profile.name;
    localStorage.setItem("kalyanGoldUser", JSON.stringify(state.user));
    $("#header-name").textContent = profile.name;
    $("#header-avatar").textContent = profile.name.trim().charAt(0).toUpperCase() || "K";
  }
  state.balancePath = `${profilePath}/bal`;
  state.balance = Number(profile?.bal ?? 0) || 0;
  const [bids, bidRecords] = await Promise.all([
    dbGet(`${DATABASE_ROOTS.bidHistory}/${phone}`),
    dbGet(`${DATABASE_ROOTS.bidRecords}/${phone}`)
  ]);
  if (!state.user || state.user.phone !== phoneNumber) return;
  state.bids = userHistoryRecords(bids, bidRecords);
  updatePointsHistory();
}

function updatePointsHistory() {
  state.pointsHistory = [
    ...state.bids.map(item => ({ ...item, title: `${item.gameType || "Bid"} · ${item.market}`, type: "Bid" })),
    ...state.depositHistory,
    ...state.withdrawalHistory
  ];
}

async function loadWalletRequests(page) {
  if (!state.user) return;
  const phone = state.user.phone;
  const loadDeposits = page === "points" || page === "deposit";
  const loadWithdrawals = page === "points" || page === "withdraw";
  const loads = [];
  if (loadDeposits) {
    loads.push(dbGet(DATABASE_ROOTS.deposits).then(data => {
      if (!state.user || state.user.phone !== phone) return;
      state.depositHistory = requestRecordsForPhone(data, phone, "deposit");
    }));
  }
  if (loadWithdrawals) {
    loads.push(dbGet(DATABASE_ROOTS.withdrawals).then(data => {
      if (!state.user || state.user.phone !== phone) return;
      state.withdrawalHistory = requestRecordsForPhone(data, phone, "withdrawal");
    }));
  }
  await Promise.all(loads);
  if (state.user?.phone === phone) updatePointsHistory();
}

function requestRecordsForPhone(data, phone, kind) {
  const decoded = decodeFirebaseObject(data);
  if (!decoded || typeof decoded !== "object") return [];
  return Object.entries(decoded)
    .filter(([key]) => key.endsWith(` ${phone}`))
    .map(([key, rawValue]) => {
      const value = decodeFirebaseValue(rawValue);
      let fields = value;
      if (typeof fields === "string") {
        try {
          fields = JSON.parse(fields);
        } catch {
          fields = [];
        }
      }
      if (!Array.isArray(fields)) fields = [];
      const isWithdrawal = kind === "withdrawal";
      return {
        id: key,
        title: isWithdrawal ? "Withdrawal request" : "Deposit request",
        date: key.slice(0, -phone.length).trim(),
        createdAt: key.slice(0, -phone.length).trim().replace(" ", "T"),
        destination: isWithdrawal ? fields[5] || fields[6] || fields[2] || "" : fields[1] || "",
        amount: isWithdrawal ? fields[7] : fields[3],
        status: fields[fields.length - 1] || "Pending",
        raw: fields
      };
    });
}

async function loadGlobalData() {
  const dateRequest = dbGet("Date").then(decodeFirebaseObject).catch(error => {
    notify(`Unable to load Firebase market date: ${error.message || "Firebase request failed."}`, "error");
    return null;
  });
  const optionalRequests = Promise.allSettled([
    dbGet(DATABASE_ROOTS.notices),
    dbGet(DATABASE_ROOTS.rates),
    dbGet(DATABASE_ROOTS.settings)
  ]);
  let dateTimeout;
  const dateInfo = await Promise.race([
    dateRequest,
    new Promise(resolve => {
      dateTimeout = window.setTimeout(() => resolve(null), 2500);
    })
  ]);
  window.clearTimeout(dateTimeout);
  state.marketDay = String(dateInfo?.day || "").replace(/^"|"$/g, "");
  state.marketTimestamp = parseFirebaseMarketDate(dateInfo?.date);
  state.marketTimestampReceivedAt = state.marketTimestamp ? Date.now() : 0;
  const marketBucket = marketBucketForDayName(state.marketDay) || marketBucketForToday();
  state.marketBucket = marketBucket;
  const [gamesResult, optionalResults] = await Promise.all([
    dbGet(marketBucket).then(value => ({ status: "fulfilled", value }), reason => ({ status: "rejected", reason })),
    optionalRequests
  ]);
  const [noticeResult, ratesResult, settingsResult] = optionalResults;
  if (gamesResult.status === "rejected") {
    state.markets = [];
    state.marketLoadError = gamesResult.reason?.message || `Could not load market data from ${marketBucket}.`;
    throw new Error(state.marketLoadError);
  }
  state.marketLoadError = "";
  const optionalData = (result, label, fallback) => {
    if (result.status === "fulfilled") return result.value;
    notify(`Unable to load ${label}: ${result.reason?.message || "Firebase request failed."}`, "error");
    return fallback;
  };
  const notice = optionalData(noticeResult, "notices", null);
  const rates = optionalData(ratesResult, "market rates", null);
  const settings = optionalData(settingsResult, "admin settings", {});
  state.markets = normalizeMarkets(gamesResult.value);
  state.notices = notice === null || notice === undefined
    ? []
    : [{ id: "Notice", title: "Notice", message: String(decodeFirebaseValue(notice)) }];
  state.rates = decodeFirebaseObject(rates);
  applyAdminSettings(settings);
}

function stopRealtimeSubscriptions() {
  for (const subscription of realtimeSources.values()) {
    if (subscription && typeof subscription.close === "function") subscription.close();
  }
  realtimeSources.clear();
  realtimeValues.clear();
  for (const timer of realtimeTimers.values()) window.clearTimeout(timer);
  realtimeTimers.clear();
  window.clearInterval(marketDayTimer);
  marketDayTimer = 0;
  realtimeUserPhone = "";
  activeMarketBucket = "";
}

function startRealtimeSubscriptions() {
  if (!state.user || typeof firebase === "undefined" || !firebase.apps.length) return;
  stopRealtimeSubscriptions();
  realtimeUserPhone = state.user.phone;
  activeMarketBucket = state.marketBucket || marketBucketForToday();
  for (const path of [
    "Date",
    DATABASE_ROOTS.notices,
    DATABASE_ROOTS.rates,
    `${DATABASE_ROOTS.settings}`,
    ...DATABASE_ROOTS.marketBuckets
  ]) {
    watchFirebasePath(path, "global");
  }
  const phone = phonePath(state.user.phone);
  for (const path of [
    `${DATABASE_ROOTS.users}/${phone}`,
    `${DATABASE_ROOTS.bidHistory}/${phone}`,
    `${DATABASE_ROOTS.bidRecords}/${phone}`
  ]) {
    watchFirebasePath(path, "user");
  }
  for (const path of [DATABASE_ROOTS.deposits, DATABASE_ROOTS.withdrawals]) {
    watchFirebasePath(path, "wallet");
  }
  marketDayTimer = window.setInterval(() => {
    syncMarketBucketSubscription();
    if (state.page === "home" || state.page === "markets") renderPage();
  }, 30_000);
}

function syncMarketBucketSubscription() {
  activeMarketBucket = state.marketBucket || marketBucketForToday();
}

function watchFirebasePath(path, refreshGroup) {
  realtimeSources.get(path)?.close();
  const databaseRef = firebase.database().ref(path);
  let refreshQueued = false;
  const handleChange = snapshot => {
    const value = snapshot.val();
    realtimeValues.set(path, value);
    applyRealtimeValue(path, value);
    if (refreshQueued) return;
    refreshQueued = true;
    window.setTimeout(() => {
      refreshQueued = false;
      scheduleRealtimeRefresh(refreshGroup);
    }, 0);
  };
  const handleError = error => {
    notify(`Firebase real-time updates failed for ${path}: ${error.message || "Permission denied or connection unavailable."}`, "error");
  };
  databaseRef.on("value", handleChange, handleError);
  realtimeSources.set(path, {
    close() {
      databaseRef.off("value", handleChange);
    }
  });
}

function applyRealtimeValue(path, value) {
  const decoded = decodeFirebaseValue(value);
  if (path === "Date") {
    const dateInfo = decodeFirebaseObject(value) || {};
    state.marketDay = String(dateInfo.day || "").replace(/^"|"$/g, "");
    state.marketTimestamp = parseFirebaseMarketDate(dateInfo.date, dateInfo.time);
    state.marketTimestampReceivedAt = state.marketTimestamp ? Date.now() : 0;
    state.marketBucket = marketBucketForDayName(state.marketDay) || marketBucketForToday();
    activeMarketBucket = state.marketBucket;
    const marketData = realtimeValues.get(state.marketBucket);
    if (marketData !== undefined) {
      state.markets = normalizeMarkets(marketData);
      state.marketLoadError = "";
    }
    return;
  }
  if (DATABASE_ROOTS.marketBuckets.includes(path)) {
    if (path === state.marketBucket) {
      state.markets = normalizeMarkets(value);
      state.marketLoadError = "";
    }
    return;
  }
  if (path === DATABASE_ROOTS.notices) {
    state.notices = decoded === null || decoded === undefined
      ? []
      : [{ id: "Notice", title: "Notice", message: String(decoded) }];
    return;
  }
  if (path === DATABASE_ROOTS.rates) {
    state.rates = decodeFirebaseObject(value);
    return;
  }
  if (path === DATABASE_ROOTS.settings) {
    applyAdminSettings(value);
    return;
  }
  if (path === `${DATABASE_ROOTS.users}/${phonePath(state.user?.phone || "")}`) {
    const profile = decodeFirebaseObject(value);
    if (!profile || typeof profile !== "object") return;
    if (profile.name) {
      state.user.name = String(profile.name);
      localStorage.setItem("kalyanGoldUser", JSON.stringify(state.user));
      $("#header-name").textContent = state.user.name;
      $("#header-avatar").textContent = state.user.name.trim().charAt(0).toUpperCase() || "K";
    }
    state.balancePath = `${DATABASE_ROOTS.users}/${phonePath(state.user.phone)}/bal`;
    state.balance = Number(profile.bal || 0);
  }
}

function scheduleRealtimeRefresh(group) {
  const existingTimer = realtimeTimers.get(group);
  if (existingTimer) window.clearTimeout(existingTimer);
  realtimeTimers.set(group, window.setTimeout(async () => {
    realtimeTimers.delete(group);
    if (!state.user || state.user.phone !== realtimeUserPhone) return;
    const refresh = group === "global"
      ? Promise.resolve()
      : group === "wallet"
        ? loadWalletRequests("points")
        : refreshUserData();
    try {
      await refresh;
      if (group === "global") syncMarketBucketSubscription();
      await renderPage();
    } catch (error) {
      notify(error.message || `Could not refresh ${group} data from Firebase.`, "error");
    }
  }, 150));
}

function marketBucketForToday(date = new Date()) {
  const day = date.getDay();
  if (day === 6) return "GAMES2";
  if (day === 0) return "GAMES3";
  return "GAMES";
}

function marketBucketForDayName(day) {
  const normalizedDay = String(day || "").trim().toLocaleLowerCase();
  if (normalizedDay === "saturday") return "GAMES2";
  if (normalizedDay === "sunday") return "GAMES3";
  if (["monday", "tuesday", "wednesday", "thursday", "friday"].includes(normalizedDay)) return "GAMES";
  return "";
}

function parseFirebaseMarketDate(value, timeValue = "") {
  const dateMatch = String(decodeFirebaseValue(value) ?? "").trim().replace(/^"|"$/g, "")
    .match(/^(\d{2})-(\d{2})-(\d{4})(?:\s+(\d{1,2}):(\d{2}):(\d{2}))?$/);
  if (!dateMatch) return null;
  const [, day, month, year, embeddedHour, embeddedMinute, embeddedSecond] = dateMatch;
  const timeMatch = String(decodeFirebaseValue(timeValue) ?? "").trim().replace(/^"|"$/g, "")
    .match(/^(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)?$/i);
  let hour = Number(embeddedHour || 0);
  let minute = Number(embeddedMinute || 0);
  let second = Number(embeddedSecond || 0);
  if (timeMatch) {
    hour = Number(timeMatch[1]);
    minute = Number(timeMatch[2]);
    second = Number(timeMatch[3]);
    if (timeMatch[4]) {
      if (hour < 1 || hour > 12) return null;
      hour %= 12;
      if (timeMatch[4].toUpperCase() === "PM") hour += 12;
    }
  }
  if (hour > 23 || minute > 59 || second > 59) return null;
  const date = new Date(Number(year), Number(month) - 1, Number(day), hour, minute, second);
  if (date.getFullYear() !== Number(year) || date.getMonth() !== Number(month) - 1 ||
      date.getDate() !== Number(day) || date.getHours() !== hour ||
      date.getMinutes() !== minute || date.getSeconds() !== second) return null;
  return date;
}

function marketNow() {
  if (!state.marketTimestamp || !state.marketTimestampReceivedAt) return new Date();
  return new Date(state.marketTimestamp.getTime() + Date.now() - state.marketTimestampReceivedAt);
}

function toRecords(data) {
  data = decodeFirebaseValue(data);
  if (data === null || data === undefined) return [];
  if (Array.isArray(data)) return data.map((value, index) => ({ ...asObject(value), id: String(index) }));
  if (typeof data !== "object") return [];
  return Object.entries(data)
    .filter(([id]) => id !== "x")
    .map(([id, value]) => ({ ...asObject(decodeFirebaseValue(value)), id }));
}

function asObject(value) {
  value = decodeFirebaseValue(value);
  return value && typeof value === "object" && !Array.isArray(value) ? value : { value };
}

function normalizeMarkets(bucket) {
  const marketsByName = new Map();
  if (!bucket || typeof bucket !== "object") return [];
  for (const [id, rawValue] of Object.entries(bucket)) {
    if (id === "x") continue;
    const game = decodeFirebaseValue(rawValue);
    if (!Array.isArray(game) || !game[0]) continue;
    const name = String(game[0]).trim();
    const key = name.toLocaleUpperCase();
    if (marketsByName.has(key)) continue;
    const resultValue = String(game[6] || "").trim();
    const category = /starline/i.test(name)
      ? "Starline"
      : /gali|disawar/i.test(name)
        ? "Gali / Disawar"
        : "Main";
    const resultParts = resultValue ? resultValue.split(/\s*-\s*/) : [];
    marketsByName.set(key, {
      id: `${category}:${id}:${key}`,
      name,
      category,
      open: resultParts[0] || "",
      close: resultParts[2] || "",
      result: resultValue,
      resultDate: "",
      openTime: String(game[1] || ""),
      closeTime: String(game[2] || ""),
      status: String(game[5] || ""),
      raw: game
    });
  }
  return [...marketsByName.values()];
}

function setPage(page) {
  state.page = page;
  window.scrollTo(0, 0);
  $("#sidebar").classList.remove("open");
  $("#drawer-scrim").classList.remove("visible");
  $$(".nav-link").forEach(link => link.classList.toggle("active",
    link.dataset.page === page || (link.dataset.page === "markets" && ["game-select", "betting"].includes(page))));
  $$(".mobile-bottom-nav [data-page]").forEach(link => link.classList.toggle("active",
    link.dataset.page === page || (link.dataset.page === "markets" && ["game-select", "betting"].includes(page))));
  const labels = {
    home: "Home", markets: "Markets", betting: "Place bid", charts: "Result chart", webviewer: state.webViewerTitle || "Results", bids: "Bids history",
    support: "Support",
    "game-select": "Choose game",
    points: "Points history", deposit: "Deposit points", withdraw: "Withdraw points",
    rates: "Market rates", notices: "Notices", policy: "Privacy & policy", howto: "How to play", profile: "My profile"
  };
  $("#page-breadcrumb").textContent = labels[page] || "Home";
  renderPage();
  if (page === "points" || page === "deposit" || page === "withdraw") {
    void loadWalletRequests(page).then(renderPage).catch(error => {
      notify(error.message || "Could not load wallet history from Firebase.", "error");
    });
  }
}

async function renderPage() {
  const root = $("#page-content");
  const renderers = {
    home: renderHome,
    support: renderSupport,
    markets: renderMarkets,
    "game-select": renderGameSelect,
    betting: renderBetting,
    charts: renderCharts,
    webviewer: renderWebViewer,
    bids: () => renderHistory("bids"),
    points: () => renderHistory("points"),
    deposit: renderDeposit,
    withdraw: renderWithdraw,
    rates: renderRates,
    notices: renderNotices,
    policy: renderPolicy,
    howto: renderHowTo,
    profile: renderProfile
  };
  const currentViewer = state.page === "webviewer" ? $(".result-webviewer", root) : null;
  if (!currentViewer || currentViewer.dataset.url !== state.webViewerUrl) {
    root.innerHTML = (renderers[state.page] || renderHome)();
  }
  const menuButton = $("#menu-toggle");
  menuButton.textContent = state.page === "home" ? "☰" : "←";
  menuButton.setAttribute("aria-label", state.page === "home" ? "Open navigation" : "Back to home");
  $("#aia-header-balance").textContent = money(state.balance);
  $$(".mobile-bottom-nav [data-page]").forEach(button => {
    button.classList.toggle("active", button.dataset.page === state.page ||
      (["betting", "game-select"].includes(state.page) && button.dataset.page === "markets"));
  });
}

function heading(title, description, action = "") {
  return `<div class="page-heading"><div><h1>${safeText(title)}</h1><p>${safeText(description)}</p></div>${action ? `<div class="heading-actions">${action}</div>` : ""}</div>`;
}

function renderWebViewer() {
  if (!state.webViewerUrl) {
    return `${heading("Web viewer", "The requested page could not be opened.")}<div class="empty-state"><strong>No page selected</strong>Choose Results or a market result to load a page here.</div>`;
  }
  return `<section class="webviewer-page">
    <div class="webviewer-toolbar">
      <button type="button" class="webviewer-back" data-page="home" aria-label="Back to home">←</button>
      <div class="webviewer-address"><small>${safeText(state.webViewerTitle || "Website")}</small><span title="${safeText(state.webViewerUrl)}">${safeText(state.webViewerUrl)}</span></div>
      <button type="button" class="webviewer-refresh" data-action="refresh-webviewer" aria-label="Reload website">↻</button>
      <a class="webviewer-open" href="${safeText(state.webViewerUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Open website in browser">↗</a>
    </div>
    <p class="webviewer-hint">If the embedded page stays blank, use ↗ to open this website.</p>
    <iframe class="result-webviewer" data-url="${safeText(state.webViewerUrl)}" src="${safeText(state.webViewerUrl)}" title="${safeText(state.webViewerTitle || "Results")} website viewer" referrerpolicy="strict-origin-when-cross-origin" allow="clipboard-read; clipboard-write; fullscreen"></iframe>
  </section>`;
}

function gameTile(game) {
  return `<button class="game-tile ${state.selectedGame === game ? "selected" : ""}" type="button" data-select-game="${safeText(game)}">
    <img src="assets/${safeText(GAME_ART[game])}" alt="" loading="lazy">
    <span>${safeText(legacyGameType(game))}</span>
  </button>`;
}

function legacyGameType(game) {
  if (game === "Single") return "Single Digit";
  if (game === "Jodi") return "Double Digit";
  return game;
}

function marketCards(markets, showAll = false) {
  if (!markets.length) {
    const detail = state.marketLoadError
      ? safeText(state.marketLoadError)
      : "Market data will appear here when it is available in the Firebase market bucket.";
    return `<div class="empty-state"><strong>No markets available</strong>${detail}</div>`;
  }
  const visibleMarkets = showAll ? markets : markets.slice(0, 6);
  return `<div class="market-grid">${visibleMarkets.map(market => {
    const isOpen = marketSessions(market).length > 0;
    const shownResult = market.result || market.raw?.[6] || "### - ## - ###";
    return `<article class="market-card aia-market-card">
        <button class="market-result-button" type="button" data-market-result="${safeText(market.id)}" aria-label="View ${safeText(market.name)} result"><img class="market-card-art" src="assets/icon-chart.png" alt="" aria-hidden="true"></button>
      <div class="market-card-info"><h3>${safeText(market.name)}</h3>
        <p><strong>Open:</strong> ${safeText(market.openTime || "—")}</p>
        <p><strong>Close:</strong> ${safeText(market.closeTime || "—")}</p>
        <span class="market-card-result">${safeText(shownResult)}</span>
      </div>
      <button class="market-play ${isOpen ? "open" : "closed"}" type="button" data-open-market="${safeText(market.id)}" ${isOpen ? "" : "disabled"} aria-label="${isOpen ? `Play ${safeText(market.name)}` : "Closed"}">${isOpen ? "▷" : "×"}</button>
    </article>`;
  }).join("")}</div>`;
}

function marketSessions(market) {
  if (!market || /closed/i.test(market.status) || marketClockStatus(market) === "closed") return [];
  const available = ["Open", "Close"].filter((session, index) => {
    const enabled = market.raw?.[index + 3];
    return enabled === undefined || String(enabled).toUpperCase() === "Y";
  });
  return marketClockStatus(market) === "after_open"
    ? available.filter(session => session === "Close")
    : available;
}

function marketClockStatus(market, now = marketNow()) {
  const parseTime = value => {
    const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
    if (!match) return null;
    let hour = Number(match[1]) % 12;
    if (match[4].toUpperCase() === "PM") hour += 12;
    const seconds = Number(match[3] || 0);
    return hour * 3600 + Number(match[2]) * 60 + seconds;
  };
  const open = parseTime(market.openTime);
  const close = parseTime(market.closeTime);
  if (open === null || close === null) return "before_open";
  const current = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  if (open <= close) {
    if (current < open) return "before_open";
    if (current < close) return "after_open";
    return "closed";
  }
  if (current >= open || current < close) return "after_open";
  return "closed";
}

function activityRows(items, emptyText = "Your recent activity will show here.") {
  if (!items.length) return `<div class="empty-state">${safeText(emptyText)}</div>`;
  return `<div class="activity-list">${items.slice(0, 4).map(item => {
    const amount = Number(item.amount || item.points || item.value || 0);
    const outgoing = /withdraw|bid|debit/i.test(String(item.type || item.status || ""));
    return `<div class="activity-row"><div class="activity-title"><span class="activity-mark">${outgoing ? "↗" : "◈"}</span><span><strong>${safeText(item.title || item.market || item.type || "Points activity")}</strong><small>${safeText(dateText(item.createdAt || item.date || item.timestamp))}</small></span></div><span class="activity-amount ${outgoing ? "out" : ""}">${outgoing ? "−" : "+"}${money(amount)}</span></div>`;
  }).join("")}</div>`;
}

function renderHome() {
  const firstName = state.user.name.trim().split(/\s+/)[0] || "there";
  const notice = state.notices[0];
  const categories = availableMarketCategories().map(category => `<button type="button" class="filter-chip ${state.category === category ? "active" : ""}" data-category="${safeText(category)}">${safeText(category)}</button>`).join("");
  const markets = marketsForCategory(state.category);
  return `<section class="aia-home-intro"><div><small>WELCOME BACK</small><h1>${safeText(firstName)}</h1></div><div class="aia-home-actions"><button type="button" data-page="deposit">＋ Add points</button><button type="button" data-page="withdraw">Withdraw</button></div></section>
    ${notice ? `<div class="notice-strip"><strong>NOTICE</strong><span>${safeText(notice.message)}</span></div>` : ""}
    <div class="aia-support-actions">
      <button class="aia-support-whatsapp" type="button" data-action="open-whatsapp"><span aria-hidden="true">◉</span> WhatsApp support</button>
      <button class="aia-support-telegram" type="button" data-action="open-telegram"><span aria-hidden="true">➤</span> Telegram</button>
    </div>
    <div class="aia-category-row">${categories}</div>
    <div class="section-head"><h2>${safeText(state.category)} markets</h2><button class="text-button" type="button" data-action="refresh">↻ Auto Refresh</button></div>
    ${marketCards(markets, true)}`;
}

function availableMarketCategories() {
  const available = MARKET_CATEGORIES.filter(category =>
    category !== "Gali / Disawar" || marketsForCategory(category).length > 0
  );
  if (!available.includes(state.category)) state.category = "Main";
  return available;
}

function marketsForCategory(category) {
  return state.markets.filter(market => category === "Main"
    ? !/starline|gali|disawar/i.test(market.category)
    : category === "Starline"
      ? /starline/i.test(market.category)
      : /gali|disawar/i.test(market.category));
}

function renderMarkets() {
  const categories = availableMarketCategories().map(category => `<button type="button" class="filter-chip ${state.category === category ? "active" : ""}" data-category="${safeText(category)}">${safeText(category)}</button>`).join("");
  const allMarkets = marketsForCategory(state.category);
  return `<div class="aia-category-row">${categories}</div>
    <div class="section-head"><h2>${safeText(state.category)} markets</h2><button class="text-button" type="button" data-action="refresh">↻ Auto Refresh</button></div>
    ${marketCards(allMarkets, true)}`;
}

function renderGameSelect() {
  const market = state.markets.find(item => item.name === state.selectedMarket);
  if (!market || !marketSessions(market).includes(state.selectedSession)) {
    return `${heading("Choose game", "This market is no longer open for the selected session.")}<button class="button button-secondary" type="button" data-page="markets">Back to markets</button>`;
  }
  const sessions = marketSessions(market);
  return `<section class="aia-bet-heading"><strong>${safeText(market.name)} <span>›</span> ${safeText(state.selectedSession)}</strong></section>
    <div class="aia-market-controls">
      <div class="aia-session-toggle">${["Open", "Close"].map(session => `<button type="button" class="${state.selectedSession === session ? "active" : ""}" data-session="${session}" ${!sessions.includes(session) ? "disabled" : ""}><span>${state.selectedSession === session ? "◉" : "◯"}</span>${session}</button>`).join("")}</div>
      <button class="aia-chart-button" type="button" data-page="charts"><img src="assets/icon-chart.png" alt=""><span>Result Chart</span></button>
    </div>
    <div class="section-head"><h2>Choose game type</h2></div>
    <div class="aia-game-grid">${GAME_TYPES.map(gameTile).join("")}</div>
    <button class="button button-secondary" type="button" data-page="markets">Back to markets</button>`;
}

function betSuggestions(game) {
  if (/single/i.test(game) && !/pana|sangam/i.test(game)) return ["0", "1", "2", "3"];
  if (/jodi/i.test(game)) return ["00", "11", "22", "33"];
  if (/pana|motor/i.test(game)) return ["111", "222", "333", "444"];
  return [];
}

function renderBetting() {
  const market = state.markets.find(item => item.name === state.selectedMarket);
  if (!market) {
    return `${heading("Place bid", "Select a market to continue.")}<button class="button button-secondary" type="button" data-page="markets">Back to markets</button>`;
  }
  const total = state.betDraft.reduce((sum, item) => sum + item.amount, 0);
  const remaining = Math.max(0, state.balance - total);
  const suggestions = betSuggestions(state.selectedGame);
  return `<section class="aia-bet-heading"><strong>${safeText(market.name)} <span>›</span> ${safeText(state.selectedSession)} <span>›</span> ${safeText(legacyGameType(state.selectedGame))}</strong></section>
    <form id="bid-form" class="aia-bet-form">
      <div class="aia-entry-fields">
        <label for="bet-selection">Enter Number :</label>
        <input id="bet-selection" name="selection" type="text" maxlength="30" autocomplete="off" inputmode="numeric">
        <div class="aia-suggestion-list">${suggestions.map(number => `<button type="button" data-number="${number}">${number}</button>`).join("")}</div>
        <label for="bet-amount">Enter Points :</label>
        <input id="bet-amount" name="amount" type="number" min="1" max="${remaining}" step="1" inputmode="numeric">
      </div>
      <button class="aia-yellow-button aia-add-button" type="button" data-action="add-bet" ${remaining < 1 ? "disabled" : ""}>ADD</button>
      <section class="aia-draft-card">
        <div class="aia-draft-columns"><span>Numbers</span><span>Points</span></div>
        <div class="aia-draft-list">${state.betDraft.length ? state.betDraft.map((item, index) => `<div class="aia-draft-row"><strong>${safeText(item.selection)}</strong><strong>${safeText(item.amount)} <button type="button" data-remove-bet="${index}" aria-label="Remove ${safeText(item.selection)}">×</button></strong></div>`).join("") : `<div class="aia-draft-empty">Add a number and points to build your bid</div>`}</div>
        <div class="aia-draft-totals"><span>Total : <strong>${money(total)}</strong></span><span>Left Points : <strong>${money(remaining)}</strong></span></div>
      </section>
      <button class="aia-yellow-button aia-submit-button" type="submit" ${!state.betDraft.length ? "disabled" : ""}>SUBMIT</button>
    </form>`;
}

function renderCharts() {
  return `${heading("Result chart", "Latest market results from the app's market database.")}
    <div class="filter-row">${availableMarketCategories().map(category => `<button type="button" class="filter-chip ${state.category === category ? "active" : ""}" data-category="${safeText(category)}">${safeText(category)}</button>`).join("")}<button type="button" class="text-button" data-action="refresh">↻ Auto Refresh results</button></div>
    ${marketCards(state.markets.filter(market => state.category === "Main"
      ? !/starline|gali|disawar/i.test(market.category)
      : state.category === "Starline" ? /starline/i.test(market.category) : /gali|disawar/i.test(market.category)))}
    <div class="warning-box">Market results are read directly from the active Firebase games bucket.</div>`;
}

function pendingRequests() {
  return [...state.depositHistory, ...state.withdrawalHistory].filter(item => /pending/i.test(String(item.status || "pending"))).length;
}

function historyTable(items, kind) {
  if (!items.length) return `<div class="empty-state"><strong>No ${kind} yet</strong>When you ${kind === "bids" ? "submit a bid" : "make a points transaction"}, it will appear here.</div>`;
  const rows = [...items].reverse().map(item => `<tr>
    <td><strong>${safeText(item.title || item.market || item.type || kind)}</strong><br><small>${safeText(item.gameType || item.selection || item.method || "")}</small></td>
    <td>${safeText(dateText(item.createdAt || item.date || item.timestamp))}</td>
    <td>${safeText(item.amount ?? item.points ?? "—")}</td>
    <td><span class="status-pill ${/pending|reject/i.test(item.status || "") ? "closed" : ""}">${safeText(item.status || "Recorded")}</span></td>
  </tr>`).join("");
  return `<div class="table-wrap"><table><thead><tr><th>${kind === "bids" ? "Market / game" : "Activity"}</th><th>Date</th><th>Points</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderHistory(kind) {
  const isBids = kind === "bids";
  if (isBids) return renderAiaBidsHistory();
  return renderAiaPointsHistory();
}

function legacyDateLabel(value) {
  const match = String(value || "").match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return String(value || "—");
  const date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  return `${match[1]}-${match[2]}-${match[3]} ${date.toLocaleDateString("en-IN", { weekday: "long" })}`;
}

function bidTime(item) {
  const payload = Array.isArray(item.payload) ? item.payload : [];
  const storedTime = String(payload[4] || "");
  return storedTime || String(item.createdAt || "").match(/T(\d{2}:\d{2}:\d{2})/)?.[1] || "—";
}

function renderAiaBidsHistory() {
  if (!state.bids.length) {
    return `${heading("My Biddings", "Your submitted bids appear here.")}<div class="empty-state"><strong>No bids yet</strong>Place a bid from the Games tab to see your history.</div>`;
  }
  const dates = new Map();
  for (const bid of state.bids) {
    if (!dates.has(bid.date)) dates.set(bid.date, new Map());
    const markets = dates.get(bid.date);
    const market = bid.market || bid.title || "Bid";
    if (!markets.has(market)) markets.set(market, []);
    markets.get(market).push(bid);
  }
  return `<section class="aia-history-page"><h1>My Biddings</h1>${[...dates.entries()].sort(([a],[b]) => b.localeCompare(a)).map(([date, markets]) => `
    <div class="aia-date-banner">${safeText(legacyDateLabel(date))}</div>
    ${[...markets.entries()].map(([market, bids]) => `<section class="aia-history-market">
      <h2>${safeText(market)}</h2>
      <div class="aia-history-columns"><span>Time</span><span>Type</span><span>Number</span><span>Points</span></div>
      ${bids.slice().sort((a,b) => String(b.id).localeCompare(String(a.id))).map(bid => `<div class="aia-history-row"><span>${safeText(bidTime(bid))}</span><span>${safeText(bid.session || bid.payload?.[1] || "Open")}</span><span>${safeText(bid.selection || bid.payload?.[2] || "")}</span><span>${safeText(bid.amount ?? bid.payload?.[3] ?? "")}</span></div>`).join("")}
    </section>`).join("")}`).join("")}</section>`;
}

function renderAiaPointsHistory() {
  const bids = state.bids;
  const played = bids.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const details = [...state.pointsHistory].sort((a, b) => String(b.id || b.createdAt).localeCompare(String(a.id || a.createdAt)));
  return `<section class="aia-history-page"><h1>Points history</h1>
    <div class="aia-points-summary"><p>Total Played : <strong>${money(played)}</strong></p><p>Remaining Points : <strong>${money(state.balance)}</strong></p><p>${bids.length} Numbers Played</p></div>
    ${details.length ? `<div class="aia-point-list">${details.map(item => {
      const isBid = item.type === "Bid" || item.session;
      const gameType = item.gameType || item.payload?.[0] || "";
      return `<article class="aia-point-card"><span class="aia-point-direction ${isBid ? "out" : ""}">${isBid ? "≪" : "≫"}</span><div><p>Points : ${safeText(item.amount ?? item.points ?? 0)}</p>${isBid ? `<p>${safeText(gameType)} <strong>${safeText(item.selection || "")}</strong></p>` : ""}<p>${safeText(legacyDateLabel(item.date || ""))} &nbsp; ${safeText(bidTime(item))}</p><p>${safeText(item.market || item.title || item.type || "Points activity")} &nbsp; - &nbsp; ${safeText(item.session || item.status || "Recorded")}</p></div></article>`;
    }).join("")}</div>` : `<div class="empty-state"><strong>No points activity yet</strong>Bid and wallet activity will appear here.</div>`}
  </section>`;
}

function renderDeposit() {
  return `${heading("Deposit points", "Send a request to add points to your account.")}
    <div class="profile-grid"><section class="panel"><div class="panel-heading"><h2>New deposit request</h2><small>Current balance: ${money(state.balance)}</small></div>
      <form id="deposit-form" class="form-stack">
        <label class="field">Amount (₹)<input name="amount" type="number" min="1" step="1" required placeholder="Enter amount"></label>
        <div class="quick-amounts">${[500,700,900,1500,2000,2500,3000,5000].map(amount => `<button class="quick-amount" type="button" data-amount="${amount}">₹${amount.toLocaleString("en-IN")}</button>`).join("")}</div>
        <label class="field">Payment method<select name="method" required><option value="">Choose payment method</option><option>UPI</option><option>Google Pay</option><option>Paytm</option><option>Other</option></select></label>
        <label class="field">Transaction reference<input name="reference" type="text" maxlength="80" placeholder="UPI transaction ID (optional)"></label>
        <button class="button button-primary" type="submit">Send deposit request <span>→</span></button>
      </form><div class="warning-box">Submitting a request does not add points automatically. Keep your payment reference and follow the administrator's instructions.</div>
    </section><section class="panel"><div class="panel-heading"><h2>Recent deposit requests</h2></div>${historyTable(state.depositHistory, "deposits")}</section></div>`;
}

function renderWithdraw() {
  const saved = savedWithdrawalDetails();
  return `${heading("Withdraw points", "Request a withdrawal to your saved payment account.")}
    <div class="profile-grid"><section class="panel"><div class="panel-heading"><h2>New withdrawal request</h2><small>Available: ${money(state.balance)}</small></div>
      <form id="withdraw-form" class="form-stack">
        <label class="field">Account holder name<input name="holderName" type="text" maxlength="80" value="${safeText(saved.holderName || "")}" placeholder="Required for bank transfer"></label>
        <label class="field">IFSC code<input name="ifsc" type="text" maxlength="20" value="${safeText(saved.ifsc || "")}" placeholder="Required for bank transfer"></label>
        <label class="field">Account number<input name="accountNumber" type="text" maxlength="40" value="${safeText(saved.accountNumber || "")}" placeholder="Required for bank transfer"></label>
        <label class="field">PhonePe number<input name="phonePay" type="tel" maxlength="20" value="${safeText(saved.phonePay || "")}" placeholder="Optional"></label>
        <label class="field">Google Pay number<input name="googlePay" type="tel" maxlength="20" value="${safeText(saved.googlePay || "")}" placeholder="Optional"></label>
        <label class="field">Amount (₹)<input name="amount" type="number" min="1" step="1" max="${Math.max(0, state.balance)}" value="${safeText(saved.amount || "")}" required placeholder="Enter amount"></label>
        <button class="button button-primary" type="submit">Send withdrawal request <span>→</span></button>
      </form><div class="warning-box">Your withdrawal details are remembered in this browser tab so you can reuse them during this session. They are submitted to Firebase only when you send a request.</div>
    </section><section class="panel"><div class="panel-heading"><h2>Recent withdrawal requests</h2></div>${historyTable(state.withdrawalHistory, "withdrawals")}</section></div>`;
}

function renderRates() {
  const rateHeading = `<div class="page-heading rate-page-heading"><div><h1>Rate Chart</h1><p>Current payout rates per ₹10, as configured by the administrator.</p></div></div>`;
  if (!state.rates) return `${rateHeading}<div class="empty-state"><strong>No rate chart available</strong>Rate information will show here when it is published to the exported Rate Chart tree.</div>`;
  const rows = toRecords(state.rates).filter(row => row.id !== "x");
  if (!rows.length) return `${rateHeading}<pre class="panel" style="white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px">${safeText(JSON.stringify(state.rates, null, 2))}</pre>`;
  const labels = ["Single Digit", "Double Digit", "Single Pana", "Double Pana", "Triple Pana", "Half Sangam", "Full Sangam"];
  return `${rateHeading}<div class="rate-chart-grid">${rows.map(row => {
    const label = row.name || row.game || labels[Number(row.id) - 1] || `Rate ${row.id}`;
    const rate = row.rate ?? row.value ?? "—";
    return `<article class="rate-chart-card"><strong>${safeText(label)}</strong><span>₹10 <i>=</i> ₹${safeText(rate)}</span></article>`;
  }).join("")}</div>`;
}

function renderSupport() {
  return `${heading("Help & support", "Get in touch with our support team.")}
    <section class="support-page">
      <h1>FOR HELP AND SUPPORT</h1>
      <div class="support-illustration" aria-hidden="true"><svg viewBox="0 0 260 220"><rect x="24" y="22" width="132" height="176" rx="18"/><rect x="37" y="38" width="106" height="145" rx="10"/><circle cx="89" cy="106" r="42"/><path d="M61 105c0-20 14-35 32-35s32 15 32 35v14h-12v-19h12m-64 5H49v14a9 9 0 0 0 9 9h9v-29h-9m70 0h-9v29h9a9 9 0 0 0 9-9v-14Z"/><path d="M89 106v-20m0 20 15 8"/><path d="M64 174c4-17 15-26 25-26s21 9 25 26"/></svg></div>
      <p>Our team is here to help with your account and app questions.</p>
      <div class="support-page-actions">
        <button class="support-contact-button whatsapp" type="button" data-action="open-whatsapp"><span aria-hidden="true">◉</span> WhatsApp</button>
        <button class="support-contact-button telegram" type="button" data-action="open-telegram"><span aria-hidden="true">➤</span> Telegram</button>
      </div>
    </section>`;
}

function withdrawalCacheKey() {
  return `kalyanGoldWithdrawal:${state.user.phone}`;
}

function savedWithdrawalDetails() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(withdrawalCacheKey()) || "{}");
    return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
  } catch (error) {
    notify(`Could not restore saved withdrawal details: ${error.message || "Invalid cached data."}`, "error");
    return {};
  }
}

function cacheWithdrawalDetails(form) {
  const values = new FormData(form);
  const saved = Object.fromEntries(
    ["holderName", "ifsc", "accountNumber", "phonePay", "googlePay", "amount"]
      .map(name => [name, String(values.get(name) || "").trim()])
  );
  try {
    sessionStorage.setItem(withdrawalCacheKey(), JSON.stringify(saved));
  } catch (error) {
    notify(`Withdrawal details could not be saved for reuse: ${error.message || "Browser storage is unavailable."}`, "error");
  }
}

function renderNotices() {
  if (!state.notices.length) return `${heading("Notices", "Important updates and information.")}<div class="empty-state"><strong>No notices right now</strong>New notices will appear here when published.</div>`;
  return `${heading("Notices", "Important updates and information.")}<section class="panel">${[...state.notices].reverse().map(item => `<article class="notice-card"><h3>${safeText(item.title || item.heading || "Notice")}</h3><p>${safeText(item.message || item.text || item.value || "")}</p><time>${safeText(dateText(item.createdAt || item.date || item.timestamp))}</time></article>`).join("")}</section>`;
}

function renderPolicy() {
  const paragraphs = state.policy.split(/\n{2,}/).map(item => item.trim()).filter(Boolean);
  return `<section class="policy-page"><header class="policy-page-heading"><p>ACCOUNT INFORMATION</p><h1>Privacy &amp; policy</h1><span>Privacy information published for Kalyan Gold.</span></header>${paragraphs.length
    ? `<section class="panel policy-content">${paragraphs.map(paragraph => `<p>${safeText(paragraph)}</p>`).join("")}</section>`
    : `<div class="empty-state"><strong>Policy is not available</strong>The administrator has not published privacy information yet.</div>`}</section>`;
}

function renderHowTo() {
  return `${heading("How to play", "A quick guide to the market and points flow.")}
    <div class="two-column">
      <section class="panel"><div class="panel-heading"><h2>Place a bid</h2></div>
        <div class="activity-list">
          ${[
            ["01", "Choose a market category", "Open Markets and choose Main, Starline or Gali / Disawar."],
            ["02", "Select an open market", "Tap its play button. Closed markets cannot be selected."],
            ["03", "Choose a game type", "Select Single Digit, Double Digit or another available game type."],
            ["04", "Enter your selection and points", "Add a number and points, then submit your bid."]
          ].map(([number, title, description]) => `<div class="activity-row"><div class="activity-title"><span class="activity-mark">${number}</span><span><strong>${title}</strong><small>${description}</small></span></div></div>`).join("")}
        </div>
      </section>
      <section class="panel"><div class="panel-heading"><h2>Game types</h2></div>
        <div class="game-list">${GAME_TYPES.map(game => `<span class="game-chip">${safeText(legacyGameType(game))}</span>`).join("")}</div>
        <div class="warning-box">Confirm market timings and rules with the operator before submitting. This website does not calculate or guarantee results or winnings.</div>
      </section>
    </div>`;
}

function renderProfile() {
  return `${heading("My profile", "Manage the details associated with your account.")}
    <div class="profile-grid"><section><div class="profile-summary"><span class="avatar">${safeText(state.user.name.trim().charAt(0).toUpperCase() || "K")}</span><span><strong>${safeText(state.user.name)}</strong><small>+91 ${safeText(state.user.phone)}</small></span></div>
      <section class="panel"><div class="panel-heading"><h2>Personal details</h2></div><form id="profile-form" class="form-stack">
        <label class="field">Full name<input name="name" type="text" required maxlength="60" value="${safeText(state.user.name)}"></label>
        <label class="field">Phone number<input type="tel" value="+91 ${safeText(state.user.phone)}" disabled></label>
        <button class="button button-primary" type="submit">Save details</button><p class="inline-message" id="profile-message"></p>
      </form></section></section>
      <section class="panel"><div class="panel-heading"><h2>Change password</h2></div><form id="password-form" class="form-stack">
        <label class="field">Current password<input name="currentPassword" type="password" required autocomplete="current-password"></label>
        <label class="field">New password<input name="newPassword" type="password" minlength="8" required autocomplete="new-password"></label>
        <label class="field">Confirm new password<input name="confirmPassword" type="password" minlength="8" required autocomplete="new-password"></label>
        <button class="button button-secondary" type="submit">Update password</button><p class="inline-message" id="password-message"></p>
      </form><div class="warning-box">This is the app's custom password flow. It does not use Firebase Authentication.</div></section></div>`;
}

function dbKey(value) {
  return String(value).replace(/[.#$\[\]/]/g, "_");
}

async function submitBid(event) {
  event.preventDefault();
  const market = state.markets.find(item => item.name === state.selectedMarket);
  const session = state.selectedSession;
  const total = state.betDraft.reduce((sum, item) => sum + item.amount, 0);
  if (!market || !state.betDraft.length || total <= 0 || total > state.balance) {
    notify(total > state.balance ? "There are not enough points in your balance." : "Add at least one valid number before submitting.", "error");
    return;
  }
  if (!marketSessions(market).includes(session)) {
    notify("This session is not available for the selected market.", "error");
    return;
  }
  const button = event.target.querySelector('button[type="submit"]');
  setBusy(button, true, "Submitting bid…");
  try {
    const current = await dbGet(state.balancePath);
    const currentBalance = Number(decodeFirebaseValue(current) || 0);
    if (total > currentBalance) throw new Error("There are not enough points in your balance.");
    const nextBalance = currentBalance - total;
    const now = marketNow();
    const createdAt = now.toISOString();
    const date = `${String(now.getDate()).padStart(2, "0")}-${String(now.getMonth() + 1).padStart(2, "0")}-${now.getFullYear()}`;
    const hour12 = now.getHours() % 12 || 12;
    const time = `${String(hour12).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
    const meridiem = now.getHours() >= 12 ? "PM" : "AM";
    const time12 = `${time} ${meridiem}`;
    const updates = { [state.balancePath]: nextBalance };
    const createdBids = state.betDraft.map((draft, index) => {
      const randomReference = Math.floor(100 + Math.random() * 900);
      const tag = `${date}&${time}&${draft.selection}&${randomReference + index}&${market.name}`;
      const recordKey = dbKey(tag);
      const bidValue = JSON.stringify([legacyGameType(state.selectedGame), session, draft.selection, String(draft.amount), time12]);
      const historyValue = `${date} ${time}:${draft.amount.toFixed(1)}:"${draft.selection}"`;
      const historyKey = dbKey(`${Date.now()}_${index}_${Math.random().toString(36).slice(2, 8)}`);
      updates[`${DATABASE_ROOTS.bidRecords}/${phonePath(state.user.phone)}/${date}/${recordKey}`] = bidValue;
      updates[`${DATABASE_ROOTS.bidHistory}/${phonePath(state.user.phone)}/${date}/${historyKey}`] = historyValue;
      return {
        id: `${date}/${historyKey}`,
        date,
        tag: historyValue,
        payload: JSON.parse(bidValue),
        title: market.name,
        market: market.name,
        category: state.category,
        gameType: legacyGameType(state.selectedGame),
        session,
        selection: draft.selection,
        amount: draft.amount,
        status: "Submitted",
        createdAt
      };
    });
    await dbPatchAndVerify(updates);
    state.balance = nextBalance;
    state.bids.push(...createdBids);
    state.pointsHistory.push(...createdBids.map(entry => ({ ...entry, type: "Bid" })));
    state.betDraft = [];
    notify(`${createdBids.length} bid${createdBids.length === 1 ? "" : "s"} submitted successfully.`);
    await renderPage();
  } catch (error) {
    notify(error.message || "Unable to submit the bid.", "error");
  } finally {
    setBusy(button, false);
  }
}

function addBetDraft() {
  const selectionField = $("#bet-selection");
  const amountField = $("#bet-amount");
  const selection = String(selectionField?.value || "").trim();
  const amount = Number(amountField?.value);
  const total = state.betDraft.reduce((sum, item) => sum + item.amount, 0);
  if (!selection || !Number.isFinite(amount) || amount <= 0) {
    notify("Enter a number and valid points amount.", "error");
    return;
  }
  if (amount > state.balance - total) {
    notify("The points amount is greater than your remaining balance.", "error");
    return;
  }
  state.betDraft.push({ selection, amount });
  renderPage();
  $("#bet-selection")?.focus();
}

async function submitRequest(event, type) {
  event.preventDefault();
  const form = event.target;
  const values = new FormData(form);
  const amount = Number(values.get("amount"));
  const isDeposit = type === "deposit";
  const destination = String(values.get("method") || "").trim();
  const holderName = String(values.get("holderName") || "").trim();
  const ifsc = String(values.get("ifsc") || "").trim();
  const accountNumber = String(values.get("accountNumber") || "").trim();
  const phonePay = String(values.get("phonePay") || "").trim();
  const googlePay = String(values.get("googlePay") || "").trim();
  if (!Number.isFinite(amount) || amount <= 0 || (isDeposit && !destination)) {
    notify("Complete the required fields with a valid amount.", "error");
    return;
  }
  if (!isDeposit && holderName && (!ifsc || !accountNumber)) {
    notify("Enter the IFSC code and account number for bank withdrawals.", "error");
    return;
  }
  if (!isDeposit && !holderName && !phonePay && !googlePay) {
    notify("Enter bank details, PhonePe, or Google Pay details.", "error");
    return;
  }
  if (!isDeposit && amount > state.balance) {
    notify("The withdrawal amount cannot exceed your available points.", "error");
    return;
  }
  if (!isDeposit) cacheWithdrawalDetails(form);
  const button = form.querySelector("button[type=submit]");
  setBusy(button, true, "Sending request…");
  try {
    const now = new Date();
    const timestamp = now.toISOString().replace("T", " ").split(".")[0];
    const key = `${timestamp} ${state.user.phone}`;
    const currentBalance = Number(decodeFirebaseValue(await dbGet(state.balancePath)) || 0);
    const updates = {};
    let requestValue;
    if (isDeposit) {
      requestValue = JSON.stringify([
        state.user.phone,
        destination,
        String(values.get("reference") || "").trim(),
        amount,
        currentBalance,
        ""
      ]);
      updates[`${DATABASE_ROOTS.deposits}/${key}`] = requestValue;
    } else {
      if (amount > currentBalance) throw new Error("The withdrawal amount cannot exceed your available points.");
      const minimum = Number(decodeFirebaseValue(await dbGet(`${DATABASE_ROOTS.settings}/MW`)) || 0);
      if (minimum && amount < minimum) throw new Error(`Minimum withdrawal amount is ₹${minimum}.`);
      const nextBalance = currentBalance - amount;
      requestValue = JSON.stringify([
        state.user.phone,
        holderName,
        accountNumber,
        holderName,
        ifsc,
        phonePay,
        googlePay,
        amount,
        nextBalance,
        ""
      ]);
      updates[`${DATABASE_ROOTS.withdrawals}/${key}`] = requestValue;
      updates[state.balancePath] = nextBalance;
    }
    await dbPatchAndVerify(updates);
    const entry = {
      id: key,
      title: isDeposit ? "Deposit request" : "Withdrawal request",
      type: isDeposit ? "Deposit" : "Withdraw",
      amount,
      method: destination,
      destination: phonePay || googlePay || accountNumber,
      status: "Pending",
      createdAt: now.toISOString()
    };
    if (isDeposit) state.depositHistory.push(entry);
    else {
      state.balance = currentBalance - amount;
      state.withdrawalHistory.push(entry);
    }
    state.pointsHistory.push(entry);
    notify(`${isDeposit ? "Deposit" : "Withdrawal"} request sent.`);
    await renderPage();
  } catch (error) {
    notify(error.message || "Unable to send your request.", "error");
  } finally {
    setBusy(button, false);
  }
}

async function saveProfile(event) {
  event.preventDefault();
  const form = event.target;
  const name = String(new FormData(form).get("name") || "").trim();
  if (name.length < 2) {
    setInlineMessage("profile-message", "Enter a name with at least 2 characters.");
    return;
  }
  try {
    const phone = phonePath(state.user.phone);
    await dbPutAndVerify(`${DATABASE_ROOTS.users}/${phone}/name`, JSON.stringify(name));
    state.user.name = name;
    localStorage.setItem("kalyanGoldUser", JSON.stringify(state.user));
    $("#header-name").textContent = name;
    $("#header-avatar").textContent = name.charAt(0).toUpperCase();
    setInlineMessage("profile-message", "Your details were updated.", true);
    await renderPage();
    notify("Profile updated.");
  } catch (error) {
    setInlineMessage("profile-message", error.message || "Unable to save profile details.");
  }
}

async function changePassword(event) {
  event.preventDefault();
  const form = event.target;
  const values = new FormData(form);
  const currentPassword = String(values.get("currentPassword") || "");
  const newPassword = String(values.get("newPassword") || "");
  if (newPassword.length < 8) {
    setInlineMessage("password-message", "New password must be at least 8 characters.");
    return;
  }
  if (newPassword !== values.get("confirmPassword")) {
    setInlineMessage("password-message", "The new passwords do not match.");
    return;
  }
  try {
    const phone = phonePath(state.user.phone);
    const userRecord = decodeFirebaseObject(await dbGet(`${DATABASE_ROOTS.users}/${phone}`));
    if (!userRecord || String(userRecord.password ?? "") !== currentPassword) {
      setInlineMessage("password-message", "Current password is incorrect.");
      return;
    }
    await dbPutAndVerify(`${DATABASE_ROOTS.users}/${phone}/password`, JSON.stringify(newPassword));
    setInlineMessage("password-message", "Password updated.", true);
    form.reset();
  } catch (error) {
    setInlineMessage("password-message", error.message || "Unable to update password.");
  }
}

async function refreshAll() {
  const refreshes = [refreshUserData(), loadGlobalData()];
  if (state.page === "points" || state.page === "deposit" || state.page === "withdraw") {
    refreshes.push(loadWalletRequests(state.page));
  }
  const outcomes = await Promise.allSettled(refreshes);
  await renderPage();
  const failures = outcomes.filter(outcome => outcome.status === "rejected");
  if (failures.length) {
    failures.forEach(outcome => notify(outcome.reason?.message || "Could not refresh data.", "error"));
  } else {
    notify("Data refreshed.");
  }
}

async function shareApp() {
  const shareData = {
    title: "Kalyan Gold Matka",
    text: "Open Kalyan Gold Matka",
    url: window.location.href
  };
  try {
    if (navigator.share) {
      await navigator.share(shareData);
      return;
    }
    if (!navigator.clipboard?.writeText) {
      throw new Error("Sharing is not supported by this browser.");
    }
    await navigator.clipboard.writeText(shareData.url);
    notify("Website link copied to clipboard.");
  } catch (error) {
    if (error?.name === "AbortError") return;
    notify(error.message || "Unable to share the website link.", "error");
  }
}

function handleClick(event) {
  const target = event.target.closest("[data-page], [data-auth-mode], [data-select-game], [data-category], [data-action], [data-amount], [data-open-market], [data-market-result], [data-drawer-toggle], [data-session], [data-number], [data-remove-bet]");
  if (!target) return;
  if (target.hasAttribute("data-drawer-toggle")) {
    $("#sidebar").classList.add("open");
    $("#drawer-scrim").classList.add("visible");
    return;
  }
  if (target.dataset.authMode) {
    showAuth(target.dataset.authMode);
    return;
  }
  if (target.dataset.page) {
    setPage(target.dataset.page);
    return;
  }
  if (target.dataset.selectGame) {
    const market = state.markets.find(item => item.name === state.selectedMarket);
    if (!market || !marketSessions(market).includes(state.selectedSession)) {
      notify("This market session is no longer open for bidding.", "error");
      setPage("markets");
      return;
    }
    state.selectedGame = target.dataset.selectGame;
    state.betDraft = [];
    setPage("betting");
    return;
  }
  if (target.dataset.session) {
    state.selectedSession = target.dataset.session;
    renderPage();
    return;
  }
  if (target.dataset.number) {
    const selection = $("#bet-selection");
    if (selection) {
      selection.value = target.dataset.number;
      selection.focus();
    }
    return;
  }
  if (target.dataset.removeBet !== undefined) {
    state.betDraft.splice(Number(target.dataset.removeBet), 1);
    renderPage();
    return;
  }
  if (target.dataset.category) {
    state.category = target.dataset.category;
    renderPage();
    return;
  }
  if (target.dataset.amount) {
    const amountField = $('input[name="amount"]', target.closest("section"));
    if (amountField) amountField.value = target.dataset.amount;
    return;
  }
  if (target.dataset.action === "refresh") {
    refreshAll();
    return;
  }
  if (target.dataset.action === "refresh-webviewer") {
    const frame = $(".result-webviewer");
    if (frame) frame.src = state.webViewerUrl;
    return;
  }
  if (target.dataset.action === "forgot-password") {
    const phone = $("#auth-phone").value.replace(/\D/g, "");
    if (!/^\d{10}$/.test(phone)) {
      notify("Enter your 10-digit phone number first.", "error");
      $("#auth-phone").focus();
      return;
    }
    try {
      openWhatsApp(`i forget password password of my number ${phone} please send my password`);
    } catch (error) {
      notify(error.message || "Unable to open WhatsApp.", "error");
    }
    return;
  }
  if (target.dataset.action === "auth-whatsapp" || target.dataset.action === "open-whatsapp") {
    try {
      openWhatsApp("Hello, I need help with my Kalyan Gold account.");
    } catch (error) {
      notify(error.message || "Unable to open WhatsApp.", "error");
    }
    return;
  }
  if (target.dataset.action === "open-telegram") {
    try {
      openExternalUrl(state.telegramUrl, "Telegram");
    } catch (error) {
      notify(error.message || "Unable to open Telegram.", "error");
    }
    return;
  }
  if (target.dataset.action === "open-results-website" || target.dataset.action === "open-website") {
    $("#sidebar").classList.remove("open");
    $("#drawer-scrim").classList.remove("visible");
    try {
      openResultsWebsite();
    } catch (error) {
      notify(error.message || "Unable to open the configured website.", "error");
    }
    return;
  }
  if (target.dataset.marketResult) {
    const market = state.markets.find(item => item.id === target.dataset.marketResult);
    if (!market) {
      notify("Market information is no longer available. Refresh and try again.", "error");
      return;
    }
    try {
      openMarketResult(market.name);
    } catch (error) {
      notify(error.message || "Unable to open this market result.", "error");
    }
    return;
  }
  if (target.dataset.action === "share-app") {
    $("#sidebar").classList.remove("open");
    $("#drawer-scrim").classList.remove("visible");
    void shareApp();
    return;
  }
  if (target.dataset.action === "change-password") {
    setPage("profile");
    window.setTimeout(() => {
      const passwordForm = $("#password-form");
      passwordForm?.scrollIntoView({ behavior: "smooth", block: "center" });
      passwordForm?.querySelector('input[name="currentPassword"]')?.focus({ preventScroll: true });
    }, 0);
    return;
  }
  if (target.dataset.openMarket) {
    const market = state.markets.find(item => item.id === target.dataset.openMarket);
    if (market) state.category = /starline/i.test(market.category) ? "Starline" : /gali|disawar/i.test(market.category) ? "Gali / Disawar" : "Main";
    if (market) {
      const sessions = marketSessions(market);
      if (!sessions.length) {
        notify("This market is closed for bidding.", "error");
        return;
      }
      state.selectedMarket = market.name;
      if (!sessions.includes(state.selectedSession)) state.selectedSession = sessions[0];
      state.selectedGame = "";
      state.betDraft = [];
      setPage("game-select");
    }
    return;
  }
  if (target.dataset.action === "add-bet") addBetDraft();
}

function handleSubmit(event) {
  if (event.target.id === "auth-form") submitAuth(event);
  if (event.target.id === "bid-form") submitBid(event);
  if (event.target.id === "deposit-form") submitRequest(event, "deposit");
  if (event.target.id === "withdraw-form") submitRequest(event, "withdraw");
  if (event.target.id === "profile-form") saveProfile(event);
  if (event.target.id === "password-form") changePassword(event);
}

document.addEventListener("click", handleClick);
document.addEventListener("submit", handleSubmit);
document.addEventListener("change", event => {
  if (event.target.matches('#bid-form select[name="market"]')) {
    state.selectedMarket = event.target.value;
    renderPage();
  }
});
$("#logout-button").addEventListener("click", logout);
$("#menu-toggle").addEventListener("click", () => {
  if (state.page !== "home") {
    setPage("home");
    return;
  }
  const open = !$("#sidebar").classList.contains("open");
  $("#sidebar").classList.toggle("open", open);
  $("#drawer-scrim").classList.toggle("visible", open);
});
$("#drawer-scrim").addEventListener("click", () => {
  $("#sidebar").classList.remove("open");
  $("#drawer-scrim").classList.remove("visible");
});
$("#sidebar").addEventListener("click", event => {
  if (event.target.closest("[data-page]")) $("#drawer-scrim").classList.remove("visible");
});
$("#current-year").textContent = new Date().getFullYear();

const sharedUserSession = getSharedSessionFromUrl();
if (sharedUserSession) {
  state.user = {
    phone: sharedUserSession.phone,
    name: sharedUserSession.name
  };
  localStorage.setItem("kalyanGoldUser", JSON.stringify(state.user));
  void enterApp();
  void loadAdminSettings().catch(error => {
    notify(error.message || "Unable to load support settings from Firebase.", "error");
  });
} else if (restoreSession()) {
  void enterApp();
} else {
  showAuth("signup");
  void loadAdminSettings().catch(error => {
    notify(error.message || "Unable to load support settings from Firebase.", "error");
  });
}
