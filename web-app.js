const firebaseConfig = {
  apiKey: "AIzaSyB8nW1wxOLhTYBj1-6k-q-jmms50GUUxGg",
  authDomain: "a2moring.firebaseapp.com",
  databaseURL: "https://a2moring-default-rtdb.firebaseio.com",
  projectId: "a2moring",
  storageBucket: "a2moring.firebasestorage.app",
  messagingSenderId: "528466835850",
  appId: "1:528466835850:web:ee5cfc804c2bdaf71fb073",
  measurementId: "G-2HVR18MNEZ"
};
const DEFAULT_WEBSITE_URL = "https://a2morningapp.vercel.app";
const MATKA60_API_URL = "https://a2morning.mama567.bond/matka60-api.php";
const MATKA60_SERVER_AUTHORIZED_BETS_READY = false;
const MATKA60_SERVER_API_READY = false;

if (window.firebase && !firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const MATKA60_RESULTS_CONFIG = {
  apiKey: "AIzaSyCGqJ1XvEYbgJ_eN5OEuzAymc3E4wKr8eI",
  authDomain: "a2morning-web-result.firebaseapp.com",
  databaseURL: "https://a2morning-web-result-default-rtdb.firebaseio.com",
  projectId: "a2morning-web-result",
  storageBucket: "a2morning-web-result.firebasestorage.app",
  messagingSenderId: "807940358876",
  appId: "1:807940358876:web:37d5de4963837b8783aa19",
  measurementId: "G-FD7MK1CWCK"
};
const matka60FirebaseApp = window.firebase
  ? firebase.apps.find(app => app.name === "matka60-results")
    || firebase.initializeApp(MATKA60_RESULTS_CONFIG, "matka60-results")
  : null;

const DATABASE_ROOTS = {
  users: "DATA",
  marketBuckets: ["GAMES", "GAMES2", "GAMES3"],
  notices: "Notice/Notice",
  rates: "Rate Chart",
  settings: "Admin/Admin",
  bidRecords: "Normal T Data",
  bidHistory: "Normal T Data2",
  newUsers: "New Users",
  deposits: "DR",
  withdrawals: "WR"
};

const GAME_TYPES = [
  "Single", "Jodi", "Bulk Jodi", "Single Pana", "Double Pana",
  "Triple Pana", "SP Motor", "DP Motor", "TP Motor", "SP DP TP",
  "Half Sangam", "Full Sangam"
];
const GAME_ART = {
  "Single": "web-game-single.jpg",
  "Jodi": "web-game-jodi.jpg",
  "Bulk Jodi": "web-game-bulk-jodi.jpg",
  "Single Pana": "web-game-single-pana.jpg",
  "Double Pana": "web-game-double-pana.jpg",
  "Triple Pana": "web-game-triple-pana.jpg",
  "SP Motor": "web-game-sp-motor.jpg",
  "DP Motor": "web-game-dp-motor.jpg",
  "TP Motor": "web-game-tp-motor.jpg",
  "SP DP TP": "web-game-sp-dp-tp.jpg",
  "Half Sangam": "web-game-half-sangam.jpg",
  "Full Sangam": "web-game-full-sangam.jpg"
};
const SP_MOTOR_ROWS = [
  ["128", "137", "146", "236", "245", "290", "380", "470", "489", "560", "579", "678"],
  ["129", "138", "147", "156", "237", "246", "345", "390", "480", "570", "589", "679"],
  ["120", "139", "148", "157", "238", "247", "256", "346", "490", "580", "670", "689"],
  ["130", "149", "158", "167", "239", "248", "257", "347", "356", "590", "680", "789"],
  ["140", "159", "168", "230", "249", "258", "267", "348", "357", "456", "690", "780"],
  ["123", "150", "169", "178", "240", "259", "268", "349", "358", "367", "457", "790"],
  ["124", "160", "278", "179", "250", "269", "340", "359", "368", "458", "467", "890"],
  ["125", "134", "170", "189", "260", "279", "350", "369", "468", "378", "459", "567"],
  ["126", "135", "180", "234", "270", "289", "360", "379", "450", "469", "478", "568"],
  ["127", "136", "145", "190", "235", "280", "370", "389", "460", "479", "569", "578"]
];
const DP_MOTOR_ROWS = [
  ["100", "119", "155", "227", "335", "344", "399", "588", "669"],
  ["200", "110", "228", "255", "336", "499", "660", "688", "778"],
  ["300", "166", "229", "337", "355", "445", "599", "779", "788"],
  ["400", "112", "220", "266", "338", "446", "455", "699", "770"],
  ["500", "113", "122", "177", "339", "366", "447", "799", "889"],
  ["600", "114", "277", "330", "448", "466", "556", "880", "899"],
  ["700", "115", "133", "188", "223", "377", "449", "557", "566"],
  ["800", "116", "224", "233", "288", "440", "477", "558", "990"],
  ["900", "117", "144", "199", "225", "388", "559", "577", "667"],
  ["550", "668", "244", "299", "226", "488", "550", "677", "118"]
];
const TP_MOTOR_DIGITS = ["777", "444", "111", "888", "555", "222", "999", "666", "333", "000"];
const BULK_JODI_ROWS = Array.from({ length: 10 }, (_, tens) =>
  Array.from({ length: 10 }, (_, ones) => `${tens}${ones}`)
);
const SP_PANA_SET = new Set(SP_MOTOR_ROWS.flat());
const DP_PANA_SET = new Set(DP_MOTOR_ROWS.flat());
const TP_PANA_SET = new Set(TP_MOTOR_DIGITS);
const SANGAM_PANA_SET = new Set([...SP_PANA_SET, ...DP_PANA_SET, ...TP_PANA_SET]);
const MARKET_CATEGORIES = ["Main", "Starline", "Gali / Disawar"];
const DEFAULT_WITHDRAWAL_WINDOWS = {
  morning: { open: "09:30", close: "13:30" },
  evening: { open: "18:45", close: "21:00" }
};
const EXPERT_GUESSING_DATABASE_URL = "https://web-result-53649-default-rtdb.firebaseio.com";
const state = {
  authMode: "signup",
  user: null,
  page: "home",
  balance: 0,
  balancePath: "",
  accountBlocked: false,
  userHistoryLoaded: false,
  markets: [],
  marketLoadError: "",
  paymentQrCode: "",
  paymentUpiId: "",
  paymentApiUrl: "",
  signUpBonus: 0,
  minimumEntry: 0,
  maximumEntry: 0,
  minimumWithdrawal: 0,
  withdrawTiming: "",
  withdrawalWindows: DEFAULT_WITHDRAWAL_WINDOWS,
  expertGuessing: {},
  expertGuessingLoadedAt: 0,
  expertGuessingLoading: false,
  expertGuessingError: "",
  expertGuessingPeriod: "day",
  selectedGuessMarket: "",
  revealedGuess: null,
  closedMarket: null,
  withdrawalDialogVisible: false,
  withdrawalDetailsVisible: false,
  insufficientWithdrawalAmount: null,
  supportDialogVisible: false,
  category: "Main",
  featureMarketPage: false,
  selectedGame: "Single",
  selectedMarket: "",
  selectedSession: "Open",
  betDraft: [],
  bids: [],
  accountTransactions: [],
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
  marketTimestampReceivedAt: 0,
  maintenance: false,
  newRegistrations: true,
  openBets: true,
  closeBets: true,
  matka60ServerOffsetMs: null,
  matka60ClockSynced: false,
  matka60Results: {},
  matka60ResultsPeriodId: "",
  matka60ResultsError: "",
  matka60BidSettlements: {},
  matka60RoundId: "",
  matka60BetType: "ank",
  matka60Digit: "0",
  matka60SelectedPannas: [],
  matka60Amount: 50,
  matka60SessionToken: "",
  matka60PendingRequest: null,
  matka60HistoryTab: "game",
  matka60HelpVisible: false
};
const realtimeSources = new Map();
const realtimeTimers = new Map();
const realtimeValues = new Map();
let marketDayTimer = 0;
let realtimeUserPhone = "";
let activeMarketBucket = "";
const activePaymentChecks = new Map();
const pageHistory = [];
let matka60ClockRef = null;
let matka60ResultsRef = null;

const query = (selector, root = document) => root.querySelector(selector);
const queryAll = (selector, root = document) => [...root.querySelectorAll(selector)];
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
  const uniqueBidKeyByHistory = new Map();
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
        const historyKey = `${date}|${parts[1]}|${parts[2]}`;
        detailsByKey.set(historyKey, {
          market: parts[parts.length - 1].split(" : ")[0],
          payload,
          bidKey: tag
        });
        if (uniqueBidKeyByHistory.has(historyKey)) uniqueBidKeyByHistory.set(historyKey, "");
        else uniqueBidKeyByHistory.set(historyKey, tag);
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
        bidKey: uniqueBidKeyByHistory.get(`${date}|${parsed.time}|${parsed.selection}`) || "",
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

function matka60ProfileBids(profile) {
  const periods = decodeFirebaseObject(profile?.matka60Bets) || {};
  return Object.entries(periods).flatMap(([period, rawEntries]) => {
    const entries = decodeFirebaseObject(rawEntries) || {};
    return Object.values(entries).filter(entry => entry && typeof entry === "object")
      .map(entry => {
        const payload = decodeFirebaseValue(entry.payload);
        const historyKey = String(entry.historyKey || "");
        const date = String(entry.date || "");
        const selection = String(entry.selection || "");
        const amount = Number(entry.amount);
        return {
          id: `${date}/${historyKey}`,
          date,
          tag: `${date} ${(payload?.[4] || "")}:${amount}:"${selection}"`,
          payload,
          title: "Matka 60",
          market: "Matka 60",
          category: "Gali / Disawar",
          gameType: String(entry.gameType || payload?.[0] || ""),
          session: "Open",
          selection,
          amount,
          status: "Submitted",
          createdAt: String(entry.createdAt || ""),
          bidKey: String(entry.bidKey || ""),
          period: String(entry.period || period)
        };
      }).filter(entry => entry.id !== "/" && Number.isFinite(entry.amount));
  });
}

async function matka60ApiRequest(action, payload, token = "") {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(MATKA60_API_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ action, ...payload }),
    cache: "no-store"
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result || result.ok !== true) {
    const error = new Error(result?.message || `Matka 60 server request failed (HTTP ${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return result;
}

async function authenticatePhoneAccount(mode, phone, password, name = "") {
  if (!window.firebase?.auth) {
    throw new Error("Secure sign-in is unavailable. Refresh the page and try again.");
  }
  const response = await matka60ApiRequest("auth", { mode, phone, password, name });
  if (typeof response.firebaseCustomToken !== "string" || !response.firebaseCustomToken ||
      typeof response.token !== "string" || !response.token) {
    throw new Error("The server did not provide valid Firebase sign-in credentials.");
  }
  const auth = firebase.auth();
  try {
    await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    const credential = await auth.signInWithCustomToken(response.firebaseCustomToken);
    const idToken = await credential.user.getIdTokenResult();
    if (credential.user.uid !== `a2_phone_${phone}` || idToken.claims.phone !== phone) {
      await auth.signOut();
      throw new Error("The Firebase account does not match this phone number.");
    }
    state.matka60SessionToken = response.token;
    sessionStorage.setItem("a2MorningMatka60Session", JSON.stringify({
      phone,
      token: response.token
    }));
    return response;
  } catch (error) {
    if (typeof response.token === "string") revokeMatka60Session(response.token);
    state.matka60SessionToken = "";
    sessionStorage.removeItem("a2MorningMatka60Session");
    throw error;
  }
}

async function restoredFirebasePhone(phone) {
  if (!window.firebase?.auth) throw new Error("Firebase Authentication is unavailable.");
  const auth = firebase.auth();
  const user = auth.currentUser || await new Promise((resolve, reject) => {
    let unsubscribe = () => {};
    unsubscribe = auth.onAuthStateChanged(
      currentUser => {
        unsubscribe();
        resolve(currentUser);
      },
      error => {
        unsubscribe();
        reject(error);
      }
    );
  });
  if (!user) return false;
  const idToken = await user.getIdTokenResult();
  if (user.uid === `a2_phone_${phone}` && idToken.claims.phone === phone) return true;
  await auth.signOut();
  return false;
}

function restoreMatka60Session(phone) {
  try {
    const session = JSON.parse(sessionStorage.getItem("a2MorningMatka60Session") || "null");
    state.matka60SessionToken = session?.phone === phone && typeof session.token === "string"
      ? session.token : "";
    if (!state.matka60SessionToken) sessionStorage.removeItem("a2MorningMatka60Session");
  } catch (error) {
    state.matka60SessionToken = "";
    sessionStorage.removeItem("a2MorningMatka60Session");
    console.error("Matka 60 session could not be restored:", error);
  }
}

function revokeMatka60Session(token) {
  if (!token) return;
  void matka60ApiRequest("logout", {}, token)
    .catch(error => console.error("Matka 60 session revocation failed:", error));
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
        throw new Error("The server returned an unreadable response.");
      }
    }
    if (!response.ok) {
      const reason = data && (data.error || data.message);
      const message = reason ? String(reason) : `HTTP ${response.status}`;
      throw new Error(`Request failed (${response.status}): ${message}`);
    }
    return data;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`Request timed out after 12 seconds. Check your connection and try again.`);
    }
    if (error instanceof Error && /^(The server|Request )/.test(error.message)) throw error;
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not connect: ${reason}`);
  } finally {
    window.clearTimeout(timeout);
  }
}

const dbGet = path => dbRequest("GET", path);
const dbPut = (path, data) => dbRequest("PUT", path, data);
const dbPatch = (path, data) => dbRequest("PATCH", path, data);
const dbPost = (path, data) => dbRequest("POST", path, data);

function paymentApiRequest(parameters) {
  let endpoint;
  try {
    endpoint = new URL(state.paymentApiUrl);
  } catch {
    return Promise.reject(new Error("The payment service URL is not configured."));
  }
  const isAppsScriptUrl = endpoint.hostname === "script.google.com"
    && /^\/macros\/s\/[^/]+\/exec$/.test(endpoint.pathname);
  const isCloudFunctionUrl = (
    endpoint.hostname.endsWith(".cloudfunctions.net")
    || endpoint.hostname.endsWith(".a.run.app")
  ) && /^\/[A-Za-z][A-Za-z0-9_-]*$/.test(endpoint.pathname);
  const isA2PhpUrl = (
    endpoint.hostname === "mama567.bond"
    || endpoint.hostname.endsWith(".mama567.bond")
  ) && /(?:^|\/)a2-payment-api\.php$/i.test(endpoint.pathname);
  if (endpoint.protocol !== "https:" || endpoint.search || endpoint.hash
      || (!isAppsScriptUrl && !isCloudFunctionUrl && !isA2PhpUrl)) {
    return Promise.reject(new Error("The configured payment service URL is invalid."));
  }
  return new Promise((resolve, reject) => {
    const callbackName = `__a2Payment_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const timeout = window.setTimeout(() => finish(new Error("The payment service did not respond in time.")), 25000);
    const finish = error => {
      window.clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
      if (error) reject(error);
    };
    window[callbackName] = result => {
      finish();
      if (!result || result.ok !== true) {
        reject(new Error(result?.message || "The payment service request failed."));
        return;
      }
      resolve(result);
    };
    endpoint.search = new URLSearchParams({ ...parameters, callback: callbackName }).toString();
    script.src = endpoint.href;
    script.onerror = () => finish(new Error("Could not connect to the payment service."));
    document.head.append(script);
  });
}

function paymentHostMessage(message) {
  const payload = JSON.stringify(message);
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(payload);
  } else if (window.parent !== window) {
    window.parent.postMessage(payload, "*");
  }
}

function pendingPaymentKey(phone) {
  return `a2morning.pendingPayment:${phone}`;
}

function readPendingPayment(phone) {
  const orders = readPendingPayments(phone);
  return orders[orders.length - 1] || null;
}

function readPendingPayments(phone) {
  try {
    const saved = JSON.parse(localStorage.getItem(pendingPaymentKey(phone)) || "null");
    const orders = Array.isArray(saved) ? saved : saved ? [saved] : [];
    return orders.filter(order => order && order.phone === phone && order.orderId && order.pollToken);
  } catch (error) {
    throw new Error(`Could not restore payment status: ${error.message || "Invalid saved order."}`);
  }
}

function savePendingPayment(order) {
  const orders = readPendingPayments(order.phone).filter(item => item.orderId !== order.orderId);
  orders.push(order);
  orders.sort((a, b) => Date.parse(a.createdAt || "") - Date.parse(b.createdAt || ""));
  localStorage.setItem(pendingPaymentKey(order.phone), JSON.stringify(orders));
}

function paymentRetrySeconds(order) {
  const createdAt = Date.parse(order?.createdAt || "");
  if (!Number.isFinite(createdAt)) return 0;
  return Math.max(0, Math.ceil((createdAt + 30_000 - Date.now()) / 1000));
}

function updatePaymentRetryCountdown() {
  queryAll("[data-payment-retry-countdown]").forEach(element => {
    const seconds = paymentRetrySeconds({ createdAt: element.dataset.createdAt });
    element.textContent = seconds ? `00:${String(seconds).padStart(2, "0")}` : "Ready";
    const card = element.closest(".payment-pending-card");
    if (card) {
      if (seconds === 0) card.style.display = "none";
      else card.style.removeProperty("display");
    }
    const button = query("[data-action='retry-pending-payment']", card);
    const form = query("#deposit-form");
    if (button && form) {
      button.disabled = seconds > 0;
      button.textContent = seconds ? `Retry payment in 00:${String(seconds).padStart(2, "0")}` : "Start another payment";
      queryAll("#deposit-form input[name='amount'], #deposit-form [data-amount], #deposit-form button[type='submit']")
        .forEach(control => { control.disabled = seconds > 0; });
    }
  });
}

function clearPendingPayment(order) {
  if (!order?.phone) return;
  const remaining = readPendingPayments(order.phone).filter(item => item.orderId !== order.orderId);
  if (remaining.length) localStorage.setItem(pendingPaymentKey(order.phone), JSON.stringify(remaining));
  else localStorage.removeItem(pendingPaymentKey(order.phone));
}

function closePaymentViewer(check) {
  if (check?.checkoutOpened) {
    paymentHostMessage({ type: "payment-close-checkout", orderId: check.orderId });
  }
  if (check?.checkoutWindow && !check.checkoutWindow.closed) check.checkoutWindow.close();
}

function resumePendingPayment() {
  if (!state.user) return;
  try {
    readPendingPayments(state.user.phone).forEach(order => startPaymentStatusPolling(order, false));
  } catch (error) {
    notify(error.message || "Could not resume payment status.", "error");
  }
}

function startPaymentStatusPolling(order, checkoutOpened, checkoutWindow = null) {
  const existingCheck = activePaymentChecks.get(order.orderId);
  if (existingCheck) {
    if (checkoutOpened) existingCheck.checkoutOpened = true;
    if (checkoutWindow) existingCheck.checkoutWindow = checkoutWindow;
    existingCheck.poll?.();
    return;
  }
  const check = {
    orderId: order.orderId,
    startedAt: Date.now(),
    order,
    timer: 0,
    failureNotified: false,
    checkoutWindow,
    inFlight: false,
    pollOnCompletion: false,
    creditPendingNotified: false,
    checkoutOpened,
    poll: null
  };
  activePaymentChecks.set(order.orderId, check);
  const poll = async () => {
    if (activePaymentChecks.get(order.orderId) !== check) return;
    if (check.inFlight) {
      check.pollOnCompletion = true;
      return;
    }
    if (Date.now() - check.startedAt >= 30 * 60 * 1000) {
      activePaymentChecks.delete(order.orderId);
      closePaymentViewer(check);
      notify("Payment status could not be confirmed before timeout. No points were added; you can check this payment again later.", "error");
      return;
    }
    check.inFlight = true;
    try {
      const result = await paymentApiRequest({
        action: "status",
        orderId: order.orderId,
        pollToken: order.pollToken
      });
      if (activePaymentChecks.get(order.orderId) !== check) return;
      const status = String(result.status || "PENDING").toUpperCase();
      if (status === "COMPLETED" && result.credited === true) {
        activePaymentChecks.delete(order.orderId);
        clearPendingPayment(order);
        closePaymentViewer(check);
        if (state.user?.phone === order.phone) {
          try {
            await refreshUserData();
            await renderPage();
          } catch (error) {
            notify("Payment was confirmed and credited, but the balance could not refresh. Reopen Wallet or refresh your balance.", "error");
          }
        }
        notify(`Payment successful. ${money(result.amount)} points added successfully.`);
        return;
      }
      if (status === "COMPLETED") {
        order.lastStatus = status;
        order.lastCheckedAt = new Date().toISOString();
        savePendingPayment(order);
        if (!check.creditPendingNotified) {
          check.creditPendingNotified = true;
          notify("The gateway confirmed payment. Verifying the wallet credit now; please keep the app open.", "error");
        }
      }
      if (["FAILED", "FAILURE", "CANCELLED", "CANCELED"].includes(status)) {
        activePaymentChecks.delete(order.orderId);
        clearPendingPayment(order);
        closePaymentViewer(check);
        notify("Payment failed or was cancelled. No points were added.", "error");
        return;
      }
      order.lastStatus = status;
      order.lastCheckedAt = new Date().toISOString();
      savePendingPayment(order);
    } catch (error) {
      if (activePaymentChecks.get(order.orderId) !== check) return;
      if (!check.failureNotified) {
        check.failureNotified = true;
        notify(error.message || "Could not check payment status. Retrying automatically.", "error");
      }
      if (Date.now() - check.startedAt >= 30 * 60 * 1000) {
        activePaymentChecks.delete(order.orderId);
        closePaymentViewer(check);
        notify("Payment status could not be confirmed before timeout. No points were added; you can check this payment again later.", "error");
        return;
      }
    } finally {
      check.inFlight = false;
    }
    if (activePaymentChecks.get(order.orderId) !== check) return;
    const pollImmediately = check.pollOnCompletion;
    check.pollOnCompletion = false;
    check.timer = window.setTimeout(poll, pollImmediately ? 0 : 5000);
  };
  check.poll = poll;
  if (checkoutOpened) {
    paymentHostMessage({
      type: "payment-open-checkout",
      checkoutUrl: order.checkoutUrl,
      orderId: order.orderId
    });
  }
  check.timer = window.setTimeout(poll, 1000);
}

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
    throw new Error(`Could not save the expected value at ${path}. Check the data path and write permission.`);
  }
}

async function dbPatchAndVerify(updates) {
  try {
    await dbPatch("", updates);
  } catch (error) {
    if (/permission denied|unauthorized|forbidden/i.test(error.message)) {
      const paths = Object.keys(updates).map(path => path.replace(/\/\d{10}(?=\/|$)/g, "/<phone>"));
      throw new Error(`The update was denied. Write permission is required for: ${paths.join(", ")}. Check the access rules.`);
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
    throw new Error(`Could not confirm saving: ${failed.map(item => item.path).join(", ")}. Check data paths and write permissions.`);
  }
}

function notify(message, kind = "success") {
  if (String(message).trim() === "The payment service URL is not configured.") return;
  const toast = document.createElement("div");
  toast.className = `toast ${kind === "error" ? "error" : ""}`;
  toast.textContent = message;
  query("#toast-region").append(toast);
  window.setTimeout(() => toast.remove(), 4300);
}

function setInlineMessage(id, message, success = false) {
  const element = query(`#${id}`);
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
  query("#startup-view").classList.add("hidden");
  query("#auth-view").classList.remove("hidden");
  query("#app-view").classList.add("hidden");
  query("#auth-form").reset();
  query("#name-field").classList.toggle("hidden", mode !== "signup");
  query("#auth-name").required = mode === "signup";
  query("#auth-password").autocomplete = mode === "signup" ? "new-password" : "current-password";
  query("#auth-whatsapp-button").classList.toggle("hidden", mode !== "signup");
  query("#forgot-password-button").classList.toggle("hidden", mode !== "login");
  query("#auth-eyebrow").textContent = mode === "signup" ? "GET STARTED" : "YOUR ACCOUNT";
  query("#auth-title").textContent = mode === "signup" ? "Register now" : "Start secure login";
  query("#auth-subtitle").textContent = mode === "signup"
    ? "Enter your details to set up your A2 MORNING account."
    : "Enter mobile number to continue.";
  query("#auth-submit").innerHTML = mode === "signup" ? "Register now <span aria-hidden=\"true\">→</span>" : "Proceed <span aria-hidden=\"true\">→</span>";
  queryAll(".auth-tab").forEach(tab => tab.classList.toggle("active", tab.dataset.authMode === mode));
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

function paymentQrSource() {
  const raw = state.paymentQrCode;
  if (/^data:image\/(?:png|jpeg|webp);base64,/i.test(raw)) return raw;
  return safeExternalUrl(raw, "payment QR code");
}

function openResultsWebsite() {
  state.webViewerTitle = "Results";
  state.webViewerUrl = safeExternalUrl(state.websiteUrl || DEFAULT_WEBSITE_URL, "website");
  setPage("webviewer");
}

function marketResultUrl(marketName) {
  const template = `${DEFAULT_WEBSITE_URL.replace(/\/+$/, "")}/web-result.html`;
  let url;
  try {
    url = new URL(template);
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
  state.paymentQrCode = String(decodeFirebaseValue(settings.qr_code) || "").trim();
  state.paymentUpiId = String(decodeFirebaseValue(settings.upi_id) || "").trim();
  state.paymentApiUrl = String(decodeFirebaseValue(settings.payment_api_url) || "").trim();
  const minimumEntry = Number(decodeFirebaseValue(settings["Min Entry"]) || 0);
  const maximumEntry = Number(decodeFirebaseValue(settings["Max Entry"]) || 0);
  state.minimumEntry = Number.isFinite(minimumEntry) ? Math.max(0, minimumEntry) : 0;
  state.maximumEntry = Number.isFinite(maximumEntry) ? Math.max(0, maximumEntry) : 0;
  const minimumWithdrawal = Number(decodeFirebaseValue(settings.MW) || 0);
  state.minimumWithdrawal = Number.isFinite(minimumWithdrawal) ? Math.max(0, minimumWithdrawal) : 0;
  state.withdrawTiming = String(decodeFirebaseValue(settings["Withdraw Timing"]) || "").trim();
  state.withdrawalWindows = normalizeWithdrawalWindows(settings.WRTiming);
  state.maintenance = /^(true|1|yes|on)$/i.test(String(decodeFirebaseValue(settings.Maintanance) || ""));
  state.newRegistrations = settings.EnableNewRegistrations === undefined
    ? true : /^(true|1|yes|on)$/i.test(String(decodeFirebaseValue(settings.EnableNewRegistrations)));
  state.openBets = settings.EnableOpenBets === undefined
    ? true : /^(true|1|yes|on)$/i.test(String(decodeFirebaseValue(settings.EnableOpenBets)));
  state.closeBets = settings.EnableCloseBets === undefined
    ? true : /^(true|1|yes|on)$/i.test(String(decodeFirebaseValue(settings.EnableCloseBets)));
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

function normalizeWithdrawalWindows(value) {
  const decoded = decodeFirebaseObject(value) || {};
  const normalizeTime = time => {
    const match = String(decodeFirebaseValue(time) || "").trim()
      .match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
    if (!match) return "";
    let hour = Number(match[1]);
    const minute = Number(match[2]);
    if (minute > 59) return "";
    if (match[3]) {
      if (hour < 1 || hour > 12) return "";
      hour %= 12;
      if (match[3].toUpperCase() === "PM") hour += 12;
    } else if (hour > 23) return "";
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  };
  const normalizeWindow = (period, openKey, closeKey) => {
    const item = decodeFirebaseObject(decoded[period]) || {};
    return {
      open: normalizeTime(item.open ?? decoded[openKey]),
      close: normalizeTime(item.close ?? decoded[closeKey])
    };
  };
  const windows = {
    morning: normalizeWindow("morning", "morningOpen", "morningClose"),
    evening: normalizeWindow("evening", "eveningOpen", "eveningClose")
  };
  return Object.values(windows).some(window => !window.open || !window.close)
    ? DEFAULT_WITHDRAWAL_WINDOWS : windows;
}

function normalizeExpertGuessing(value) {
  const decoded = decodeFirebaseValue(value);
  if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) return {};
  return Object.fromEntries(Object.entries(decoded).map(([market, rawGuess]) => {
    const guess = decodeFirebaseValue(rawGuess);
    if (!guess || typeof guess !== "object" || Array.isArray(guess)) return [market, null];
    const displayValue = raw => {
      const value = decodeFirebaseValue(raw);
      if (Array.isArray(value)) return value.map(item => String(decodeFirebaseValue(item) ?? "").trim()).filter(Boolean).join(" - ");
      if (value && typeof value === "object" && Object.keys(value).every(key => /^\d+$/.test(key))) {
        return Object.entries(value).sort(([left], [right]) => Number(left) - Number(right))
          .map(([, item]) => String(decodeFirebaseValue(item) ?? "").trim()).filter(Boolean).join(" - ");
      }
      return String(value || "").trim();
    };
    return [market, {
      marketName: String(decodeFirebaseValue(guess.marketName) || market),
      ank: displayValue(guess.ANK ?? guess.ank),
      jodi: displayValue(guess.JODI ?? guess.jodi),
      panna: displayValue(guess.PANNA ?? guess.panna)
    }];
  }).filter(([, guess]) => guess));
}

async function loadExpertGuessing(force = false) {
  if (!force && state.expertGuessingLoadedAt && Date.now() - state.expertGuessingLoadedAt < 30_000) return;
  state.expertGuessingLoading = true;
  state.expertGuessingError = "";
  try {
    const response = await fetch(`${EXPERT_GUESSING_DATABASE_URL}/ExpertGuessing.json`, {
      cache: "no-store"
    });
    if (!response.ok) throw new Error(`Expert numbers could not be loaded (HTTP ${response.status}).`);
    state.expertGuessing = normalizeExpertGuessing(await response.json());
    state.expertGuessingLoadedAt = Date.now();
  } catch (error) {
    state.expertGuessingError = error.message || "Expert numbers could not be loaded.";
    throw error;
  } finally {
    state.expertGuessingLoading = false;
  }
}

function isBlockedValue(value) {
  const decoded = decodeFirebaseValue(value);
  return decoded !== null && decoded !== undefined && decoded !== false && decoded !== 0
    && !/^(false|0|no|off|x)?$/i.test(String(decoded).trim());
}

async function loadAdminSettings() {
  applyAdminSettings(await dbGet(DATABASE_ROOTS.settings));
}

async function configuredSignUpBonus() {
  const settings = decodeFirebaseObject(await dbGet(DATABASE_ROOTS.settings)) || {};
  const rawBonus = settings.bonus ?? settings.Bonus ?? settings["Sign Up Bonus"] ?? 0;
  const bonus = Number(decodeFirebaseValue(rawBonus));
  if (!Number.isFinite(bonus) || bonus < 0) {
    throw new Error("The configured signup bonus is not a valid non-negative amount.");
  }
  return bonus;
}

async function ensureUserBalance(profilePath) {
  if (!window.firebase?.database) {
    throw new Error("The account balance could not be initialized because the service is unavailable.");
  }
  const balanceRef = firebase.database().ref(`${profilePath}/COINS`);
  const existingBalance = await balanceRef.once("value");
  if (existingBalance.exists()) return decodeFirebaseValue(existingBalance.val());

  const bonus = await configuredSignUpBonus();
  const result = await balanceRef.transaction(current => current === null ? bonus : undefined);
  return decodeFirebaseValue(result.snapshot.val());
}

async function submitAuth(event) {
  event.preventDefault();
  const button = query("#auth-submit");
  const phone = query("#auth-phone").value.replace(/\D/g, "");
  const password = query("#auth-password").value;
  const name = query("#auth-name").value.trim();
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
    const result = await authenticatePhoneAccount(
      state.authMode,
      phone,
      password,
      state.authMode === "signup" ? name : ""
    );
    state.user = { phone, name: String(result.name || name || "Player") };
    localStorage.setItem("a2MorningUser", JSON.stringify(state.user));
    await enterApp();
    if (state.authMode === "signup") {
      notify("Your account is ready.");
      if (Array.isArray(result.warnings)) result.warnings.forEach(message => notify(message, "error"));
    } else {
      notify(`Welcome back, ${state.user.name}.`);
    }
  } catch (error) {
    notify(error.message || "Unable to access your account.", "error");
  } finally {
    setBusy(button, false);
  }
}

function restoreSession() {
  try {
    const user = JSON.parse(localStorage.getItem("a2MorningUser") || "null");
    if (user && /^\d{10}$/.test(user.phone) && typeof user.name === "string") {
      state.user = user;
      return true;
    }
    localStorage.removeItem("a2MorningUser");
  } catch {
    localStorage.removeItem("a2MorningUser");
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
  revokeMatka60Session(state.matka60SessionToken);
  if (window.firebase?.auth) {
    void firebase.auth().signOut().catch(error => {
      console.error("Firebase sign-out failed:", error);
      notify("Could not fully sign out of Firebase. Please close this tab and retry.", "error");
    });
  }
  activePaymentChecks.forEach(check => {
    window.clearTimeout(check.timer);
    closePaymentViewer(check);
  });
  activePaymentChecks.clear();
  pageHistory.length = 0;
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: "onesignal-logout" }));
  }
  stopRealtimeSubscriptions();
  state.user = null;
  state.page = "home";
  state.balance = 0;
  state.balancePath = "";
  state.accountBlocked = false;
  state.userHistoryLoaded = false;
  state.accountBlocked = false;
  state.bids = [];
  state.accountTransactions = [];
  state.pointsHistory = [];
  state.matka60BidSettlements = {};
  state.matka60SessionToken = "";
  state.matka60PendingRequest = null;
  sessionStorage.removeItem("a2MorningMatka60Session");
  stopMatka60Feed();
  state.depositHistory = [];
  state.withdrawalHistory = [];
  localStorage.removeItem("a2MorningUser");
  showAuth("login");
  query("#sidebar").classList.remove("open");
}

async function enterApp(verifyRestoredAccount = false) {
  if (!state.user) return;
  if (verifyRestoredAccount) {
    const phone = state.user.phone;
    const profile = decodeFirebaseObject(await dbGet(`${DATABASE_ROOTS.users}/${phonePath(phone)}`));
    if (!profile || typeof profile !== "object") {
      localStorage.removeItem("a2MorningUser");
      state.user = null;
      showAuth("signup");
      return;
    }
    const blocked = isBlockedValue(profile.blocked)
      || isBlockedValue(await dbGet(`Blocked/${phonePath(phone)}`));
    if (!state.user || state.user.phone !== phone) return;
    if (blocked) {
      state.accountBlocked = true;
      logout();
      notify("This account has been blocked. Contact support for help.", "error");
      return;
    }
  }
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: "onesignal-login",
      phone: state.user.phone
    }));
  }
  stopRealtimeSubscriptions();
  state.page = "home";
  pageHistory.length = 0;
  state.balance = 0;
  state.balancePath = "";
  state.accountBlocked = false;
  state.userHistoryLoaded = false;
  state.bids = [];
  state.accountTransactions = [];
  state.pointsHistory = [];
  state.matka60BidSettlements = {};
  state.depositHistory = [];
  state.withdrawalHistory = [];
  query("#auth-view").classList.add("hidden");
  query("#startup-view").classList.add("hidden");
  query("#app-view").classList.remove("hidden");
  query("#sidebar").classList.remove("open");
  query("#drawer-scrim").classList.remove("visible");
  query("#exit-dialog")?.classList.add("hidden");
  query("#current-year").textContent = new Date().getFullYear();
  query("#header-name").textContent = state.user.name;
  query("#header-avatar").textContent = state.user.name.trim().charAt(0).toUpperCase() || "K";
  void recordLastSeen().catch(error => notify(error.message || "Could not update your last seen time.", "error"));
  resumePendingPayment();
  await renderPage();
  startRealtimeSubscriptions();
  startMatka60Feed();
  const phone = state.user.phone;
  void Promise.allSettled([refreshUserData(), loadGlobalData()]).then(async outcomes => {
    if (!state.user || state.user.phone !== phone) return;
    for (const outcome of outcomes) {
      if (outcome.status === "rejected") {
        notify(outcome.reason?.message || "Could not load app data.", "error");
      }
    }
    syncMarketBucketSubscription();
    await renderPage();
  });
}

async function recordLastSeen() {
  if (!state.user) return;
  await dbPut(`${DATABASE_ROOTS.users}/${phonePath(state.user.phone)}/Last Seen`, new Date().toISOString());
}

window.__a2NativePushId = pushId => {
  if (!state.user) return;
  const path = `${DATABASE_ROOTS.users}/${phonePath(state.user.phone)}/push`;
  void dbPutAndVerify(path, String(pushId || ""))
    .catch(error => notify(error.message || "Could not save this device's push ID.", "error"));
};

async function refreshUserData() {
  if (!state.user) return;
  const phoneNumber = state.user.phone;
  const phone = phonePath(phoneNumber);
  const profilePath = `${DATABASE_ROOTS.users}/${phone}`;
  const profile = decodeFirebaseObject(await dbGet(profilePath));
  if (!state.user || state.user.phone !== phoneNumber) return;
  if (profile && profile.name && profile.name !== state.user.name) {
    state.user.name = profile.name;
    localStorage.setItem("a2MorningUser", JSON.stringify(state.user));
    query("#header-name").textContent = profile.name;
    query("#header-avatar").textContent = profile.name.trim().charAt(0).toUpperCase() || "K";
  }
  state.balancePath = `${profilePath}/COINS`;
  const balance = await ensureUserBalance(profilePath);
  if (!state.user || state.user.phone !== phoneNumber) return;
  state.balance = Number(decodeFirebaseValue(balance) ?? 0) || 0;
  const [bids, bidRecords, transactions] = await Promise.all([
    dbGet(`${DATABASE_ROOTS.bidHistory}/${phone}`),
    dbGet(`${DATABASE_ROOTS.bidRecords}/${phone}`),
    dbGet(`${DATABASE_ROOTS.users}/${phone}/transactions`)
  ]);
  if (!state.user || state.user.phone !== phoneNumber) return;
  const legacyBids = userHistoryRecords(bids, bidRecords);
  const legacyBidIds = new Set(legacyBids.map(bid => bid.id));
  state.bids = [
    ...legacyBids,
    ...matka60ProfileBids(profile).filter(bid => !legacyBidIds.has(bid.id))
  ];
  state.accountTransactions = normalizeAccountTransactions(transactions);
  state.matka60BidSettlements = profile?.matka60BidSettlements
    && typeof profile.matka60BidSettlements === "object"
    ? profile.matka60BidSettlements : {};
  state.userHistoryLoaded = true;
  updatePointsHistory();
}

function normalizeAccountTransactions(value) {
  const records = decodeFirebaseObject(value);
  if (!records || typeof records !== "object") return [];
  return Object.entries(records)
    .filter(([, record]) => record && typeof record === "object" && !Array.isArray(record))
    .map(([key, record]) => ({
      ...record,
      id: String(record.id || key),
      type: String(record.type || "Wallet"),
      amount: Number(record.amount) || 0,
      title: String(record.title || record.note || record.type || "Wallet activity"),
      date: String(record.date || record.createdAt || ""),
      status: String(record.status || "Recorded")
    }));
}

function updatePointsHistory() {
  state.pointsHistory = [
    ...state.bids.map(item => ({ ...item, title: `${item.gameType || "Bid"} · ${item.market}`, type: "Bid" })),
    ...state.depositHistory,
    ...state.withdrawalHistory,
    ...state.accountTransactions
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
    notify(`Unable to load market date: ${error.message || "Request failed."}`, "error");
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
    notify(`Unable to load ${label}: ${result.reason?.message || "Request failed."}`, "error");
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
    `${DATABASE_ROOTS.bidRecords}/${phone}`,
    `Blocked/${phone}`
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
    notify(`Live updates failed: ${error.message || "Permission denied or connection unavailable."}`, "error");
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
  const blockedMatch = path.match(/^Blocked\/(\d{10,})$/);
  const profilePath = `${DATABASE_ROOTS.users}/${phonePath(state.user?.phone || "")}`;
  const profile = path === profilePath ? decodeFirebaseObject(value) : null;
  if ((blockedMatch && state.user?.phone === blockedMatch[1] && isBlockedValue(decoded))
    || (profile && isBlockedValue(profile.blocked))) {
    state.accountBlocked = true;
    logout();
    notify("This account has been blocked. Contact support for help.", "error");
    return;
  }
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
  if (path === profilePath) {
    if (!profile || typeof profile !== "object") return;
    if (profile.name) {
      state.user.name = String(profile.name);
      localStorage.setItem("a2MorningUser", JSON.stringify(state.user));
      query("#header-name").textContent = state.user.name;
      query("#header-avatar").textContent = state.user.name.trim().charAt(0).toUpperCase() || "K";
    }
    state.balancePath = `${DATABASE_ROOTS.users}/${phonePath(state.user.phone)}/COINS`;
    state.balance = Number(decodeFirebaseValue(profile.COINS) || 0);
    state.accountBlocked = false;
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
      notify(error.message || `Could not refresh ${group} data.`, "error");
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

function matka60ServerNow() {
  return state.matka60ClockSynced
    ? Date.now() + state.matka60ServerOffsetMs
    : null;
}

function matka60PeriodId(timestamp) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date(timestamp));
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}${values.month}${values.day}${values.hour}${values.minute}`;
}

function matka60RoundLabel(periodId) {
  if (!/^\d{12}$/.test(periodId)) return periodId;
  const date = new Date(
    Date.UTC(
      Number(periodId.slice(0, 4)),
      Number(periodId.slice(4, 6)) - 1,
      Number(periodId.slice(6, 8)),
      Number(periodId.slice(8, 10)),
      Number(periodId.slice(10, 12))
    ) - 330 * 60000
  );
  return Number.isNaN(date.getTime())
    ? periodId
    : date.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
}

function matka60PreviousPeriodId(timestamp) {
  return matka60PeriodId(timestamp - 60000);
}

function startMatka60Feed() {
  if (!state.user || !matka60FirebaseApp || matka60ClockRef) return;
  const database = matka60FirebaseApp.database();
  state.matka60ClockSynced = false;
  matka60ClockRef = database.ref(".info/serverTimeOffset");
  matka60ClockRef.on("value", snapshot => {
    const offset = Number(snapshot.val());
    state.matka60ClockSynced = Number.isFinite(offset);
    state.matka60ServerOffsetMs = state.matka60ClockSynced ? offset : null;
    syncMatka60ResultsFeed();
    updateMatka60Clock();
  }, error => {
    state.matka60ClockSynced = false;
    state.matka60ResultsError = `Shared clock unavailable: ${error.message || error}`;
    updateMatka60Clock();
  });
}

function syncMatka60ResultsFeed() {
  const serverNow = matka60ServerNow();
  if (!matka60FirebaseApp || serverNow === null) return;
  const completedPeriodId = matka60PreviousPeriodId(serverNow);
  if (completedPeriodId === state.matka60ResultsPeriodId) return;
  matka60ResultsRef?.off();
  state.matka60ResultsPeriodId = completedPeriodId;
  state.matka60Results = {};
  state.matka60ResultsError = "";
  matka60ResultsRef = matka60FirebaseApp.database()
    .ref("matka60/rounds")
    .orderByKey()
    .endAt(completedPeriodId)
    .limitToLast(30);
  matka60ResultsRef.on("value", snapshot => {
    state.matka60Results = snapshot.val() || {};
    state.matka60ResultsError = "";
    if (state.page === "matka60") void renderPage();
  }, error => {
    state.matka60ResultsError = `Could not load official results: ${error.message || error}. Betting is paused.`;
    if (state.page === "matka60") void renderPage();
  });
}

function stopMatka60Feed() {
  matka60ClockRef?.off();
  matka60ResultsRef?.off();
  matka60ClockRef = null;
  matka60ResultsRef = null;
  state.matka60ResultsPeriodId = "";
  state.matka60Results = {};
  state.matka60ClockSynced = false;
  state.matka60ServerOffsetMs = null;
}

function matka60PannasForDigit(digit) {
  return [...SANGAM_PANA_SET]
    .filter(number => String(number.split("").reduce((sum, value) => sum + Number(value), 0) % 10) === digit)
    .sort();
}

function matka60ValidResult(record) {
  const rawValue = typeof record === "string"
    ? record
    : record && typeof record === "object" ? String(record.result || "") : "";
  const value = rawValue.trim().replace(/^(\d)-(\d)-(\d)$/, "$1$2$3");
  return /^\d{3}$/.test(value) ? value : "";
}

function matka60ResultIsFinalized(record) {
  if (typeof record === "string") return Boolean(matka60ValidResult(record));
  return Boolean(record && typeof record === "object" && record.finalized === true);
}

function matka60BidSettlementFor(bid) {
  const periodId = String(bid.payload?.[5] || "");
  return state.matka60BidSettlements?.[periodId]?.[dbKey(bid.id)] || null;
}

function matka60LatestResult() {
  const serverNow = matka60ServerNow();
  if (serverNow === null) return null;
  const completedPeriod = matka60PreviousPeriodId(serverNow);
  const result = matka60ValidResult(state.matka60Results[completedPeriod]);
  return result ? { period: completedPeriod, result } : null;
}

function updateMatka60Clock() {
  const serverNow = matka60ServerNow();
  if (serverNow !== null) syncMatka60ResultsFeed();
  if (state.page !== "matka60") return;
  const timer = query("#matka60-time-left");
  const period = query("#matka60-period");
  const status = query("#matka60-round-status");
  const motor = query("#matka60-motor-numbers");
  if (!timer || !period || !status || !motor) return;
  if (serverNow === null) {
    timer.textContent = "--:--";
    period.textContent = "Syncing";
    status.textContent = state.matka60ResultsError || "Connecting to the shared game clock…";
    return;
  }
  const roundId = matka60PeriodId(serverNow);
  const millisecondsLeft = 60000 - (serverNow % 60000);
  const secondsLeft = Math.ceil(millisecondsLeft / 1000);
  timer.textContent = `${String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:${String(secondsLeft % 60).padStart(2, "0")}`;
  period.textContent = `#${roundId}`;
  if (roundId !== state.matka60RoundId) {
    state.matka60RoundId = roundId;
    state.matka60SelectedPannas = [];
    void renderPage();
    return;
  }
  const latestResult = matka60LatestResult();
  motor.classList.add("is-spinning");
  motor.innerHTML = Array.from({ length: 3 }, () => `<span>${Math.floor(Math.random() * 10)}</span>`).join("");
  status.textContent = state.matka60ResultsError
    || (latestResult
      ? `Last official result · round #${latestResult.period}: ${latestResult.result}`
      : "Random motor preview · waiting for the manually published result");
}

function matka60BetHistoryForPeriod(periodId) {
  return state.bids.filter(bid =>
    String(bid.gameType || "").startsWith("Matka 60")
      && String(bid.payload?.[5] || "") === periodId
  ).sort((left, right) => String(right.id).localeCompare(String(left.id)));
}

function renderMatka60History() {
  if (state.matka60HistoryTab === "bets") {
    const bets = state.bids
      .filter(bid => String(bid.gameType || "").startsWith("Matka 60"))
      .slice()
      .sort((left, right) => String(right.id).localeCompare(String(left.id)))
      .slice(0, 30);
    return `<div class="matka60-history-list">${bets.length
      ? bets.map(bid => {
        const settlement = matka60BidSettlementFor(bid);
        const outcome = settlement
          ? `${settlement.outcome}${settlement.outcome === "Won" ? ` · ${money(settlement.payout)}` : ""}`
          : "";
        return `<div class="matka60-history-row"><span><strong>${safeText(bid.selection)}</strong><small>${safeText(bid.gameType)} · ${safeText(bidTime(bid))}${outcome ? ` · ${safeText(outcome)}` : ""}</small></span><b>${money(bid.amount)}</b></div>`;
      }).join("")
      : `<p class="matka60-empty">Your Matka 60 bets will appear here.</p>`}</div>`;
  }
  const results = Object.entries(state.matka60Results || {})
    .map(([period, record]) => ({ period, result: matka60ValidResult(record) }))
    .filter(item => item.result && item.period < state.matka60RoundId)
    .sort((left, right) => right.period.localeCompare(left.period))
    .slice(0, 10);
  return `<div class="matka60-history-list"><div class="matka60-history-head"><span>PERIOD</span><span>ANK</span><span>RESULT</span></div>${results.length
    ? results.map(item => `<div class="matka60-history-row matka60-result-row"><span><strong>${safeText(item.period)}</strong><small>${safeText(matka60RoundLabel(item.period))}</small></span><b>${safeText(String((Number(item.result[0]) + Number(item.result[1]) + Number(item.result[2])) % 10))}</b><span class="matka60-result-digits">${item.result.split("").map(digit => `<b>${digit}</b>`).join("")}</span></div>`).join("")
    : `<p class="matka60-empty">Completed official results will appear here.</p>`}</div>`;
}

function renderMatka60() {
  const serverNow = matka60ServerNow();
  const roundId = serverNow === null ? "" : matka60PeriodId(serverNow);
  const secondsLeft = serverNow === null ? null : Math.ceil((60000 - (serverNow % 60000)) / 1000);
  const timerLabel = secondsLeft === null
    ? "--:--"
    : `${String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:${String(secondsLeft % 60).padStart(2, "0")}`;
  if (roundId && roundId !== state.matka60RoundId) state.matka60RoundId = roundId;
  const latestResult = matka60LatestResult();
  const selectedPannas = state.matka60SelectedPannas;
  const currentBets = matka60BetHistoryForPeriod(roundId);
  const amount = Number(state.matka60Amount);
  const motorPreview = Array.from({ length: 3 }, () => Math.floor(Math.random() * 10)).join("");
  const unavailableMessage = state.maintenance
    ? "Game play is temporarily unavailable during maintenance."
    : state.accountBlocked ? "This account is blocked from placing games."
      : !MATKA60_SERVER_AUTHORIZED_BETS_READY || !MATKA60_SERVER_API_READY
        ? "Matka 60 is paused until server-authorized bets and database write rules are configured."
        : state.matka60ResultsError ? "The shared game feed is unavailable. Betting is paused."
          : !state.matka60ClockSynced ? "Syncing the shared game clock. Betting is paused." : "";
  const selectionButtons = state.matka60BetType === "ank"
    ? `<div class="matka60-number-grid">${Array.from({ length: 10 }, (_, digit) => `<button type="button" class="${state.matka60Digit === String(digit) ? "selected" : ""}" data-matka60-number="${digit}">${digit}</button>`).join("")}</div>`
    : `<p class="matka60-selection-label">SELECT PANNA(S) FOR (${safeText(state.matka60Digit)}) · Selected: ${selectedPannas.length}</p><div class="matka60-panna-grid">${matka60PannasForDigit(state.matka60Digit).map(number => `<button type="button" class="${selectedPannas.includes(number) ? "selected" : ""}" data-matka60-number="${number}">${number}</button>`).join("")}</div>`;
  const selections = state.matka60BetType === "ank"
    ? [state.matka60Digit]
    : selectedPannas;
  const quickAdds = [10, 50, 100, 500].map(value => `<button type="button" data-matka60-quick-add="${value}">+${value}</button>`).join("");
  return `<section class="matka60-page">
    <header class="matka60-header"><button type="button" class="matka60-back" data-action="matka60-back" aria-label="Back">‹</button><h1>Matka 60</h1><button type="button" class="matka60-help" data-action="matka60-help">? HOW TO PLAY</button></header>
    <section class="matka60-balance"><div><small>TOTAL BALANCE</small><strong>${money(state.balance)}</strong></div><button type="button" data-page="deposit">＋ ADD CASH</button></section>
    <section class="matka60-round-info"><div><small>▤ PERIOD</small><strong id="matka60-period">#${safeText(roundId || "Syncing")}</strong></div><div><small>◷ TIME LEFT</small><strong id="matka60-time-left">${safeText(timerLabel)}</strong></div></section>
    <div class="matka60-progress" aria-hidden="true"><span></span></div>
    <section class="matka60-motor" aria-label="Random motor preview"><div class="matka60-motor-frame"><div id="matka60-motor-numbers" class="matka60-motor-digits is-spinning">${motorPreview.split("").map(digit => `<span>${digit}</span>`).join("")}</div></div><p id="matka60-round-status">${safeText(state.matka60ResultsError || (latestResult ? `Last official result · round #${latestResult.period}: ${latestResult.result}` : "Random motor preview · waiting for the manually published result"))}</p></section>
    ${state.matka60HelpVisible ? `<aside class="matka60-help-panel"><strong>How to play</strong><span>Choose Ank or Panna, select your number, set points per number and place your bet before the round timer ends. Results come from the locked Firebase feed; the Hostinger server settles finalized rounds and credits any winnings to your wallet.</span></aside>` : ""}
    ${unavailableMessage ? `<div class="matka60-warning" role="status">${safeText(unavailableMessage)}</div>` : ""}
    <form id="matka60-bet-form" class="matka60-bet-card">
      <h2>⚡ SELECT BET TYPE</h2>
      <div class="matka60-type-toggle"><button type="button" class="${state.matka60BetType === "ank" ? "active" : ""}" data-matka60-type="ank">▦ ANK (SINGLE)</button><button type="button" class="${state.matka60BetType === "panna" ? "active" : ""}" data-matka60-type="panna">⠿ PANNA</button></div>
      ${state.matka60BetType === "panna" ? `<p class="matka60-selection-label">SELECT DIGIT TO VIEW PANNAS:</p><div class="matka60-digit-strip">${Array.from({ length: 10 }, (_, digit) => `<button type="button" class="${state.matka60Digit === String(digit) ? "selected" : ""}" data-matka60-digit="${digit}">${digit}</button>`).join("")}</div>` : ""}
      ${selectionButtons}
      <div class="matka60-quick-adds">${quickAdds}</div>
      <div class="matka60-place-row"><label class="matka60-amount"><span>₹</span><input id="matka60-amount" type="number" min="1" step="1" inputmode="numeric" value="${safeText(amount)}" aria-label="Points per number"></label><button type="submit" ${!selections.length || !state.matka60ClockSynced || unavailableMessage ? "disabled" : ""}>PLACE BET ✓</button></div>
    </form>
    <section class="matka60-session-bets"><h2>SESSION BETS (${currentBets.length})</h2>${currentBets.length
      ? currentBets.map(bid => `<div><span>${safeText(bid.selection)} <small>${safeText(bid.gameType.replace("Matka 60 ", ""))}</small></span><strong>${money(bid.amount)}</strong></div>`).join("")
      : `<p>No active bets placed yet for this round.</p>`}</section>
    <section class="matka60-history-card"><div class="matka60-history-tabs"><button type="button" class="${state.matka60HistoryTab === "game" ? "active" : ""}" data-matka60-history="game">◷ GAME HISTORY</button><button type="button" class="${state.matka60HistoryTab === "bets" ? "active" : ""}" data-matka60-history="bets">▤ MY BET HISTORY</button></div>${renderMatka60History()}</section>
  </section>`;
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
      position: game[7] !== undefined && game[7] !== "" && Number.isFinite(Number(game[7]))
        ? Number(game[7]) : Number(id) || Number.MAX_SAFE_INTEGER,
      raw: game
    });
  }
  return [...marketsByName.values()].sort((left, right) =>
    left.position - right.position || left.name.localeCompare(right.name)
  );
}

function setPage(page, recordHistory = true) {
  const previousPage = state.page;
  state.supportDialogVisible = false;
  if (recordHistory && state.user && state.page !== page) pageHistory.push(state.page);
  state.page = page;
  if (page === "matka60") startMatka60Feed();
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: "screen-capture",
      prevent: page === "bids" || page === "points"
    }));
  }
  if (page === "withdraw") state.withdrawalDialogVisible = !withdrawalWindowAt(marketNow()).open;
  else {
    state.withdrawalDialogVisible = false;
    state.insufficientWithdrawalAmount = null;
  }
  if (page !== "markets") state.featureMarketPage = false;
  if (page === "home") state.category = "Main";
  window.scrollTo(0, 0);
  query("#sidebar").classList.remove("open");
  query("#drawer-scrim").classList.remove("visible");
  queryAll(".nav-link").forEach(link => link.classList.toggle("active",
    link.dataset.page === page || (link.dataset.page === "markets" && ["game-select", "betting", "matka60"].includes(page))));
  queryAll(".mobile-bottom-nav [data-page]").forEach(link => link.classList.toggle("active",
    link.dataset.page === page || (link.dataset.page === "markets" && ["game-select", "betting", "matka60"].includes(page))));
  const labels = {
    home: "Home", markets: "Markets", matka60: "Matka 60", betting: "Place bid", charts: "Result chart", webviewer: state.webViewerTitle || "Results", bids: "Bids history",
    "expert-guessing": "Free expert guessing", "guess-scratch": "Scratch to reveal",
    support: "Support",
    "game-select": "Choose game",
    points: "Points history", deposit: "Deposit points", withdraw: "Withdraw points",
    rates: "Market rates", notices: "Notices", policy: "Privacy & policy", howto: "How to play", profile: "My profile"
  };
  const pageTitle = labels[page] || "Home";
  query("#page-breadcrumb").textContent = pageTitle;
  query(".aia-mobile-brand strong").textContent = page === "home" ? "A2 MORNING" : pageTitle;
  renderPage();
  if (page === "points" || page === "deposit" || page === "withdraw") {
    void loadWalletRequests(page).then(renderPage).catch(error => {
      notify(error.message || "Could not load wallet history.", "error");
    });
  }
}

function closeExitDialog() {
  query("#exit-dialog")?.classList.add("hidden");
}

function showExitDialog() {
  query("#exit-dialog")?.classList.remove("hidden");
}

function handleAppBack() {
  if (state.supportDialogVisible) {
    state.supportDialogVisible = false;
    void renderPage();
    return;
  }
  const sidebar = query("#sidebar");
  if (sidebar.classList.contains("open")) {
    sidebar.classList.remove("open");
    query("#drawer-scrim").classList.remove("visible");
    return;
  }
  if (!state.user) return;
  if (!query("#exit-dialog").classList.contains("hidden")) {
    closeExitDialog();
    return;
  }
  const previousPage = pageHistory.pop();
  if (previousPage) {
    setPage(previousPage, false);
    return;
  }
  showExitDialog();
}

window.__a2HandleBack = handleAppBack;
window.__a2PaymentReturned = () => {
  if (!state.user) return;
  try {
    const order = readPendingPayment(state.user.phone);
    if (order) startPaymentStatusPolling(order, false);
  } catch (error) {
    notify(error.message || "Could not resume payment confirmation.", "error");
  }
};
window.addEventListener("message", event => {
  if (event.source !== window.parent) return;
  if (event.data === "a2morning:back") handleAppBack();
  if (event.data === "a2morning:payment-returned") window.__a2PaymentReturned();
});

async function renderPage() {
  const root = query("#page-content");
  const renderers = {
    home: renderHome,
    support: () => "",
    markets: renderMarkets,
    matka60: renderMatka60,
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
    profile: renderProfile,
    "expert-guessing": renderExpertGuessing,
    "guess-scratch": renderGuessScratch
  };
  const currentViewer = state.page === "webviewer" ? query(".result-webviewer", root) : null;
  if (!currentViewer || currentViewer.dataset.url !== state.webViewerUrl) {
    root.innerHTML = (renderers[state.page] || renderHome)()
      + (state.supportDialogVisible ? renderSupportDialog() : "");
  } else if (state.supportDialogVisible && !query(".support-sheet-backdrop", root)) {
    root.insertAdjacentHTML("beforeend", renderSupportDialog());
  } else if (!state.supportDialogVisible) {
    query(".support-sheet-backdrop", root)?.remove();
  }
  const menuButton = query("#menu-toggle");
  menuButton.textContent = state.page === "home" ? "☰" : "←";
  menuButton.setAttribute("aria-label", state.page === "home" ? "Open navigation" : "Go back");
  query("#aia-header-balance").textContent = money(state.balance);
  queryAll(".mobile-bottom-nav [data-page]").forEach(button => {
    button.classList.toggle("active", button.dataset.page === state.page ||
      (["betting", "game-select"].includes(state.page) && button.dataset.page === "markets"));
  });
  updatePaymentRetryCountdown();
}

function heading(title, description, action = "") {
  return `<div class="page-heading"><div><h1>${safeText(title)}</h1><p>${safeText(description)}</p></div>${action ? `<div class="heading-actions">${action}</div>` : ""}</div>`;
}

function renderWebViewer() {
  if (!state.webViewerUrl) {
    return `${heading("Web viewer", "The requested page could not be opened.")}<div class="empty-state"><strong>No page selected</strong>Choose Results or a market result to load a page here.</div>`;
  }
  return `<section class="webviewer-page">
    <iframe class="result-webviewer" data-url="${safeText(state.webViewerUrl)}" src="${safeText(state.webViewerUrl)}" title="${safeText(state.webViewerTitle || "Results")} website viewer" referrerpolicy="strict-origin-when-cross-origin" allow="clipboard-read; clipboard-write; fullscreen"></iframe>
  </section>`;
}

function gameTile(game) {
  return `<button class="game-tile ${state.selectedGame === game ? "selected" : ""}" type="button" data-select-game="${safeText(game)}">
    <img src="${safeText(GAME_ART[game])}" alt="" loading="lazy">
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
      : "Market data will appear here when it is available.";
    return `<div class="empty-state"><strong>No markets available</strong>${detail}</div>`;
  }
  const visibleMarkets = showAll ? markets : markets.slice(0, 6);
  return `<div class="market-grid">${visibleMarkets.map(market => {
    const isOpen = marketSessions(market).length > 0;
    const shownResult = market.result || market.raw?.[6] || "### - ## - ###";
    const closed = state.closedMarket?.id === market.id;
    return `<article class="market-card aia-market-card ${isOpen ? "market-open" : "market-closed"}">
        <div class="market-card-times"><span><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/></svg>OPEN TIME: ${safeText(market.openTime || "—")}</span><i aria-hidden="true">•</i><span>CLOSE TIME: ${safeText(market.closeTime || "—")}</span></div>
        <button class="market-result-button" type="button" data-market-result="${safeText(market.id)}" aria-label="View ${safeText(market.name)} result"><img class="market-card-art" src="web-icon-chart.png" alt="" aria-hidden="true"></button>
      <div class="market-card-info"><h3>${safeText(market.name)}</h3>
        <span class="market-card-result"><span>${safeText(shownResult)}</span></span>
      </div>
      <button class="market-play ${isOpen ? "open" : "closed"}" type="button" data-open-market="${safeText(market.id)}" aria-label="${isOpen ? `Play ${safeText(market.name)}` : `Show ${safeText(market.name)} closing time`}">${isOpen ? `<svg viewBox="0 0 36 36" aria-hidden="true"><path d="M12 7.5a1.5 1.5 0 0 1 2.3-1.28l17 10.5a1.5 1.5 0 0 1 0 2.56l-17 10.5a1.5 1.5 0 0 1-2.3-1.28z"/></svg>` : `<svg viewBox="0 0 36 36" aria-hidden="true"><path d="M11 15V11a7 7 0 0 1 14 0v4M8 15h20v15H8z"/><circle cx="25" cy="26" r="8"/><path d="M25 21v5l3 2"/></svg>`}</button>
      <div class="market-card-status ${isOpen ? "open" : "closed"}">${isOpen ? "OPEN BETTING RUNNING" : "MARKET CLOSED"}</div>
      ${closed ? `<div class="mama-dialog-backdrop" role="presentation"><section class="mama-dialog market-closed-dialog" role="dialog" aria-modal="true" aria-labelledby="closed-market-title"><div class="mama-dialog-icon" aria-hidden="true"><svg viewBox="0 0 48 48"><path d="M12 21v-7a10 10 0 0 1 20 0v7M9 21h23v19H9z"/><circle cx="34" cy="34" r="10"/><path d="M34 28v6l4 2"/></svg></div><div class="mama-dialog-body"><h2 id="closed-market-title">${safeText(market.name)}</h2><strong>MARKET IS CLOSED</strong><div class="mama-dialog-times"><span><small>OPEN TIME</small><b>${safeText(market.openTime || "—")}</b></span><i></i><span><small>CLOSE TIME</small><b>${safeText(market.closeTime || "—")}</b></span></div><button class="button button-primary" type="button" data-action="dismiss-market-closed">OK, UNDERSTOOD</button></div></section></div>` : ""}
    </article>`;
  }).join("")}</div>`;
}

function marketSessions(market) {
  if (state.accountBlocked || !market || /closed/i.test(market.status) || marketClockStatus(market) === "closed") return [];
  const available = ["Open", "Close"].filter((session, index) => {
    if (state.maintenance || !(session === "Open" ? state.openBets : state.closeBets)) return false;
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
  const markets = marketsForCategory(state.category);
  return `${renderHomeOverview()}
    <div class="section-head"><h2>${safeText(marketCategoryLabel(state.category))} markets</h2><button class="text-button" type="button" data-action="refresh">↻ Auto Refresh</button></div>
    ${marketCards(markets, true)}`;
}

function renderHomeOverview() {
  return `<section class="aia-home-panel">
    <div class="aia-welcome-banner notice-strip" role="status"><span>NOTICE&nbsp;&nbsp; Welcome To World Best Online Matka Play App</span></div>
    <div class="aia-feature-buttons">
      <button type="button" data-action="open-feature-markets" data-feature-category="Starline"><span class="aia-play-icon">▶</span>SUPER STARLINE</button>
      <button type="button" data-action="open-feature-markets" data-feature-category="Gali / Disawar"><span class="aia-play-icon">▶</span>SUPER JACKPOT</button>
    </div>
    <button class="aia-expert-banner" type="button" data-action="open-expert-guessing">
      <span class="aia-expert-icon" aria-hidden="true"><svg viewBox="0 0 48 48"><path class="aia-medal-ribbon" d="M17 26v15l7-4 7 4V26"/><circle class="aia-medal-ring" cx="24" cy="20" r="13"/><path class="aia-medal-star" d="m24 12 2.3 4.8 5.2.7-3.8 3.7.9 5.2-4.6-2.5-4.6 2.5.9-5.2-3.8-3.7 5.2-.7z"/></svg></span>
      <span class="aia-expert-copy"><strong>EXPERT GUESSING</strong><small>Free market tips from experts</small></span>
      <span class="aia-expert-arrow" aria-hidden="true">›</span>
    </button>
    <div class="aia-home-actions">
      <button type="button" data-page="deposit"><span aria-hidden="true">₹</span>ADD MONEY</button>
      <button type="button" data-page="withdraw"><span aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3 9h18M5 9v9m5-9v9m4-9v9m5-9v9M3 20h18M12 4 3 8h18z"/></svg></span>WITHDRAW</button>
    </div>
    ${state.maintenance ? `<div class="notice-strip"><strong>MAINTENANCE</strong><span>Game play is temporarily unavailable. Please check back later.</span></div>` : ""}
  </section>`;
}

function availableMarketCategories() {
  const available = MARKET_CATEGORIES.filter(category =>
    category !== "Gali / Disawar" || marketsForCategory(category).length > 0
  );
  if (!available.includes(state.category)) state.category = "Main";
  return available;
}

function marketCategoryLabel(category) {
  return category === "Gali / Disawar" ? "Super Jackpot" : category;
}

function marketsForCategory(category) {
  return state.markets.filter(market => category === "Main"
    ? !/starline|gali|disawar/i.test(market.category)
    : category === "Starline"
      ? /starline/i.test(market.category)
      : /gali|disawar/i.test(market.category))
    .sort((left, right) => left.position - right.position || left.name.localeCompare(right.name));
}

function renderMarkets() {
  if (state.featureMarketPage) {
    return `<section class="feature-market-page">
      <header><button class="feature-market-back" type="button" data-page="home" aria-label="Back to home">‹</button><h1>${safeText(marketCategoryLabel(state.category))}</h1></header>
      ${marketCards(marketsForCategory(state.category), true)}
    </section>`;
  }
  const allMarkets = marketsForCategory(state.category);
  return `${renderHomeOverview()}
    <div class="section-head"><h2>${safeText(marketCategoryLabel(state.category))} markets</h2><button class="text-button" type="button" data-action="refresh">↻ Auto Refresh</button></div>
    ${marketCards(allMarkets, true)}`;
}

function marketOpenMinute(market) {
  const time = String(market.openTime || "").trim();
  const twelveHour = time.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (twelveHour) {
    let hour = Number(twelveHour[1]) % 12;
    if (twelveHour[3].toUpperCase() === "PM") hour += 12;
    return hour * 60 + Number(twelveHour[2]);
  }
  const twentyFourHour = time.match(/^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/);
  return twentyFourHour ? Number(twentyFourHour[1]) * 60 + Number(twentyFourHour[2]) : null;
}

function guessingMarketPeriod(market) {
  const openMinute = marketOpenMinute(market);
  return openMinute !== null && (openMinute >= 18 * 60 || openMinute < 6 * 60) ? "night" : "day";
}

function expertGuessFor(market) {
  const match = Object.entries(state.expertGuessing).find(([name, guess]) =>
    String(guess.marketName || name).trim().toLocaleLowerCase() === market.name.trim().toLocaleLowerCase()
  );
  if (!match) return null;
  const guess = match[1];
  return {
    ank: String(guess.ank || "").trim().split(/\s*[-,]\s*/).filter(Boolean),
    jodi: String(guess.jodi || "").trim().split(/\s*[-,]\s*/).filter(Boolean),
    panna: String(guess.panna || "").trim().split(/\s*[-,]\s*/).filter(Boolean)
  };
}

function guessRevealKey(market) {
  return `a2morning.expertGuess:${state.user?.phone || "guest"}:${market.name.trim().toLocaleLowerCase()}`;
}

function legacyGuessRevealKey(market) {
  const now = marketNow();
  const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return `a2morning.expertGuess:${state.user?.phone || "guest"}:${dateKey}:${market.name.trim().toLocaleLowerCase()}`;
}

function getRevealedGuess(market) {
  try {
    const saved = JSON.parse(localStorage.getItem(guessRevealKey(market)) || "null");
    const now = Date.now();
    const revealDuration = 24 * 60 * 60 * 1000;
    if (saved && typeof saved === "object" && saved.guess && Number.isFinite(saved.revealedAt)) {
      if (now - saved.revealedAt < revealDuration) return saved.guess;
      localStorage.removeItem(guessRevealKey(market));
    } else if (saved && typeof saved === "object") {
      return saved;
    }

    const legacy = JSON.parse(localStorage.getItem(legacyGuessRevealKey(market)) || "null");
    if (legacy && typeof legacy === "object") {
      localStorage.setItem(guessRevealKey(market), JSON.stringify({ revealedAt: now, guess: legacy }));
      return legacy;
    }
    return null;
  } catch (error) {
    notify(`Could not restore the revealed expert numbers: ${error.message || "Invalid saved data."}`, "error");
    return null;
  }
}

function renderExpertGuessing() {
  const period = state.expertGuessingPeriod;
  const markets = state.markets.filter(market =>
    guessingMarketPeriod(market) === period
  );
  const now = marketNow();
  const date = now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  return `<section class="expert-guessing-page">
    <header class="expert-guessing-header"><button type="button" class="expert-back-button" data-action="expert-back" aria-label="Back">‹</button><h1>Free Guessing From Experts</h1></header>
    <div class="expert-guessing-banner"><strong>Daily Expert Lucky Numbers</strong><span>${safeText(date)} · Scratch To Reveal · 24 Hours Same</span></div>
    <div class="expert-period-tabs" role="tablist" aria-label="Market session">
      <button type="button" role="tab" aria-selected="${period === "day"}" class="${period === "day" ? "active" : ""}" data-expert-period="day">☀ Day Markets</button>
      <button type="button" role="tab" aria-selected="${period === "night"}" class="${period === "night" ? "active" : ""}" data-expert-period="night">☾ Night Markets</button>
    </div>
    ${state.expertGuessingLoading ? `<div class="empty-state"><strong>Loading expert numbers</strong>Please wait while the latest market tips are fetched.</div>`
      : state.expertGuessingError ? `<div class="empty-state"><strong>Expert numbers unavailable</strong>${safeText(state.expertGuessingError)}<button type="button" class="button button-secondary" data-action="refresh-expert-guessing">Try again</button></div>`
        : markets.length ? `<div class="expert-market-list">${markets.map(market => {
      const revealed = getRevealedGuess(market);
      const guesses = expertGuessFor(market);
      const hasNumbers = Boolean(guesses && Object.values(guesses).some(values => values.length));
      return `<article class="expert-market-card"><h2>${safeText(market.name)}</h2><div class="expert-market-content">
        ${revealed ? `<div class="expert-number-list">${[["ANK", revealed.ank], ["JODI", revealed.jodi], ["PANNA", revealed.panna]].filter(([, number]) => number).map(([label, number]) => `<div><strong>${label}</strong><b>${safeText(Array.isArray(number) ? number.join(" - ") : number)}</b></div>`).join("")}</div>`
          : `<button type="button" class="expert-unlock-button" data-unlock-guess="${safeText(market.id)}" ${hasNumbers ? "" : "disabled"}><span aria-hidden="true">${hasNumbers ? "♙" : "✦"}</span><strong>${hasNumbers ? "Tap To Unlock" : "Tips Coming Soon"}</strong>${hasNumbers ? "" : "<small>Expert numbers will appear here</small>"}</button>`}
        </div></article>`;
    }).join("")}</div>` : `<div class="empty-state"><strong>No ${period} markets available</strong>Market expert tips will appear here when markets are published.</div>`}
    <p class="expert-disclaimer">For entertainment only. Expert numbers are not a promise of results. Play responsibly.</p>
  </section>`;
}

function renderGuessScratch() {
  const market = state.markets.find(item => item.id === state.selectedGuessMarket);
  const guess = market ? expertGuessFor(market) : null;
  if (!market || !guess || !Object.values(guess).some(values => values.length)) {
    return `${heading("Scratch to reveal", "Expert numbers are not available for this market.")}<button class="button button-secondary" type="button" data-action="expert-back">Back to expert guessing</button>`;
  }
  const revealed = getRevealedGuess(market);
  return `<section class="guess-scratch-page"><header><button type="button" class="expert-back-button" data-action="expert-back" aria-label="Back">‹</button><div><small>DAILY EXPERT LUCKY NUMBERS</small><h1>${safeText(market.name)}</h1></div></header>
    <div class="guess-scratch-board">${revealed
      ? `<div class="expert-number-list">${[["ANK", revealed.ank], ["JODI", revealed.jodi], ["PANNA", revealed.panna]].filter(([, number]) => number && (!Array.isArray(number) || number.length)).map(([label, number]) => `<div><strong>${label}</strong><b>${safeText(Array.isArray(number) ? number.join(" - ") : number)}</b></div>`).join("")}</div>`
      : `<div class="guess-scratch-cover"><span aria-hidden="true">✦</span><strong>SCRATCH</strong><small>Reveal Expert Numbers</small><button type="button" data-action="scratch-guess">Scratch to reveal</button></div>`}
    </div><p class="expert-disclaimer">For entertainment only. These numbers do not guarantee a result. Play responsibly.</p>
  </section>`;
}

function renderSupportDialog() {
  return `<div class="support-sheet-backdrop" role="presentation">
    <section class="support-sheet" role="dialog" aria-modal="true" aria-labelledby="support-sheet-title">
      <header><span class="support-sheet-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 13a8 8 0 0 1 16 0v4a2 2 0 0 1-2 2h-2v-6h4M4 13h4v6H6a2 2 0 0 1-2-2z"/><path d="M8 20h5"/></svg></span><h2 id="support-sheet-title">Contact Support</h2><button type="button" data-action="close-support" aria-label="Close support">×</button></header>
      <button class="support-sheet-contact whatsapp" type="button" data-action="open-whatsapp"><span aria-hidden="true">▣</span> WhatsApp Support</button>
      <button class="support-sheet-contact telegram" type="button" data-action="open-telegram"><span aria-hidden="true">➤</span> Telegram Support</button>
    </section>
  </div>`;
}

function renderGameSelect() {
  const market = state.markets.find(item => item.name === state.selectedMarket);
  if (!market || !marketSessions(market).includes(state.selectedSession)) {
    return `${heading("Choose game", "This market is no longer open for the selected session.")}<button class="button button-secondary" type="button" data-page="markets">Back to markets</button>`;
  }
  const sessions = marketSessions(market);
  return `<section class="aia-bet-heading" style="margin-top: 5px"><strong>${safeText(market.name)} <span>›</span> ${safeText(state.selectedSession)}</strong></section>
    <div class="aia-market-controls">
      <div class="aia-session-toggle">${["Open", "Close"].map(session => `<button type="button" class="${state.selectedSession === session ? "active" : ""}" data-session="${session}" ${!sessions.includes(session) ? "disabled" : ""}><span>${state.selectedSession === session ? "◉" : "◯"}</span>${session}</button>`).join("")}</div>
      <button class="aia-chart-button" type="button" data-market-result="${safeText(market.id)}" aria-label="View ${safeText(market.name)} result"><img src="web-icon-chart.png" alt=""><span>Result Chart</span></button>
    </div>
    <div class="section-head"><h2>Choose game type</h2></div>
    <div class="aia-game-grid">${GAME_TYPES.map(gameTile).join("")}</div>
    <button class="button button-secondary" type="button" data-page="markets">Back to markets</button>`;
}

function betSuggestions(game) {
  if (["SP Motor", "DP Motor", "TP Motor", "SP DP TP", "Bulk Jodi"].includes(game)) {
    return ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
  }
  if (/single/i.test(game) && !/pana|sangam/i.test(game)) return ["0", "1", "2", "3"];
  if (/jodi/i.test(game)) return ["00", "11", "22", "33"];
  if (game === "Single Pana") return SP_MOTOR_ROWS[0].slice(0, 4);
  if (game === "Double Pana") return DP_MOTOR_ROWS[0].slice(0, 4);
  if (game === "Triple Pana") return TP_MOTOR_DIGITS.slice(0, 4);
  return [];
}

function isThreeDigitPanel(value) {
  return /^\d{3}$/.test(value) && SANGAM_PANA_SET.has(value);
}

function getMotorNumbers(game, digit) {
  if (!/^\d$/.test(digit)) return [];
  if (game === "Bulk Jodi") return BULK_JODI_ROWS[Number(digit)];
  const index = digit === "0" ? 9 : Number(digit) - 1;
  if (index < 0 || index > 9) return [];
  if (game === "SP Motor") return SP_MOTOR_ROWS[index];
  if (game === "DP Motor") return DP_MOTOR_ROWS[index];
  if (game === "TP Motor") return [TP_MOTOR_DIGITS[index]];
  if (game === "SP DP TP") {
    return [...SP_MOTOR_ROWS[index], ...DP_MOTOR_ROWS[index], TP_MOTOR_DIGITS[index]];
  }
  return null;
}

function buildBetSelections(game, session, primary, secondary) {
  if (game === "Half Sangam") {
    const panel = primary;
    const ank = secondary;
    if (!isThreeDigitPanel(panel)) {
      throw new Error("Enter a valid three-digit Sangam panel.");
    }
    if (!/^\d$/.test(ank)) {
      throw new Error("Enter a single digit for the other session.");
    }
    return [session === "Open" ? `${panel}-${ank}` : `${ank}-${panel}`];
  }
  if (game === "Full Sangam") {
    if (!isThreeDigitPanel(primary) || !isThreeDigitPanel(secondary)) {
      throw new Error("Enter valid three-digit Open and Close panels.");
    }
    const openJodi = String(primary.split("").reduce((sum, value) => sum + Number(value), 0) % 10);
    const closeJodi = String(secondary.split("").reduce((sum, value) => sum + Number(value), 0) % 10);
    return [`${primary}-${openJodi}${closeJodi}-${secondary}`];
  }
  if (["SP Motor", "DP Motor", "TP Motor", "SP DP TP", "Bulk Jodi"].includes(game)) {
    const numbers = getMotorNumbers(game, primary);
    if (!numbers?.length) throw new Error("Enter one digit from 0 to 9 to select the numbers.");
    return numbers;
  }
  if (game === "Single" && /^\d$/.test(primary)) return [primary];
  if (game === "Jodi" && /^\d{2}$/.test(primary)) return [primary];
  if (game === "Single Pana" && SP_PANA_SET.has(primary)) return [primary];
  if (game === "Double Pana" && DP_PANA_SET.has(primary)) return [primary];
  if (game === "Triple Pana" && TP_PANA_SET.has(primary)) return [primary];
  throw new Error("Enter a valid number for the selected game type.");
}

function renderBetting() {
  const market = state.markets.find(item => item.name === state.selectedMarket);
  if (!market) {
    return `${heading("Place bid", "Select a market to continue.")}<button class="button button-secondary" type="button" data-page="markets">Back to markets</button>`;
  }
  const total = state.betDraft.reduce((sum, item) => sum + item.amount, 0);
  const remaining = Math.max(0, state.balance - total);
  const suggestions = betSuggestions(state.selectedGame);
  const unavailableMessage = state.maintenance
    ? "Game play is temporarily unavailable during maintenance."
    : state.accountBlocked ? "This account is blocked from placing games." : "";
  const sangam = ["Half Sangam", "Full Sangam"].includes(state.selectedGame);
  const halfSangam = state.selectedGame === "Half Sangam";
  const isMotor = ["SP Motor", "DP Motor", "TP Motor", "SP DP TP", "Bulk Jodi"].includes(state.selectedGame);
  const firstLabel = halfSangam
    ? state.selectedSession === "Open" ? "Open Panel (3 digits) :" : "Close Panel (3 digits) :"
    : state.selectedGame === "Full Sangam" ? "Open Panel (3 digits) :" : isMotor ? "Enter Digit (0–9) :" : "Enter Number :";
  const secondLabel = halfSangam
    ? state.selectedSession === "Open" ? "Close Ank (1 digit) :" : "Open Ank (1 digit) :"
    : "Close Panel (3 digits) :";
  const primaryMaxLength = sangam ? 3 : isMotor ? 1 : state.selectedGame === "Single" ? 1 : state.selectedGame === "Jodi" ? 2 : 3;
  const primaryInput = `<input id="bet-selection" name="selection" type="text" maxlength="${primaryMaxLength}" autocomplete="off" inputmode="numeric" ${unavailableMessage ? "disabled" : ""}>`;
  const entryFields = sangam
    ? `<div class="aia-entry-fields aia-multi-fields">
        <label for="bet-selection">${firstLabel}</label>${primaryInput}
        <label for="bet-selection-secondary">${secondLabel}</label><input id="bet-selection-secondary" name="selectionSecondary" type="text" maxlength="${halfSangam ? 1 : 3}" autocomplete="off" inputmode="numeric" ${unavailableMessage ? "disabled" : ""}>
        <label for="bet-amount">Enter Points :</label><input id="bet-amount" name="amount" type="number" min="1" max="${remaining}" step="1" inputmode="numeric" ${unavailableMessage ? "disabled" : ""}>
        <p class="aia-entry-help">${halfSangam
          ? "Half Sangam: enter a 3-digit panel and a single ank for the selected session."
          : "Full Sangam: enter Open and Close panels; their digit totals form the Jodi."}</p>
      </div>`
    : `<div class="aia-entry-fields">
        <label for="bet-selection">${firstLabel}</label>
        ${primaryInput}
        <div class="aia-suggestion-list">${suggestions.map(number => `<button type="button" data-number="${number}" ${unavailableMessage ? "disabled" : ""}>${number}</button>`).join("")}</div>
        <label for="bet-amount">Enter Points :</label>
        <input id="bet-amount" name="amount" type="number" min="1" max="${remaining}" step="1" inputmode="numeric" ${unavailableMessage ? "disabled" : ""}>
        ${isMotor ? `<p class="aia-entry-help">The selected digit expands into ${state.selectedGame === "Bulk Jodi" ? "10 Jodi numbers" : state.selectedGame === "SP DP TP" ? "all 22 SP, DP and TP numbers" : `${state.selectedGame === "SP Motor" ? "12" : state.selectedGame === "DP Motor" ? "9" : "1"} ${state.selectedGame} number${state.selectedGame === "TP Motor" ? "" : "s"}`}. Points are charged for each expanded number.</p>` : ""}
      </div>`;
  return `<section class="aia-bet-heading" style="margin-top: 5px"><strong>${safeText(market.name)} <span>›</span> ${safeText(state.selectedSession)} <span>›</span> ${safeText(legacyGameType(state.selectedGame))}</strong></section>
    ${unavailableMessage ? `<div class="warning-box">${safeText(unavailableMessage)}</div>` : ""}
    <form id="bid-form" class="aia-bet-form">
      ${entryFields}
      <button class="aia-yellow-button aia-add-button" type="button" data-action="add-bet" ${remaining < 1 || unavailableMessage ? "disabled" : ""}>ADD</button>
      <section class="aia-draft-card">
        <div class="aia-draft-columns"><span>Numbers</span><span>Points</span></div>
        <div class="aia-draft-list">${state.betDraft.length ? state.betDraft.map((item, index) => `<div class="aia-draft-row"><strong>${safeText(item.selection)}</strong><strong>${safeText(item.amount)} <button type="button" data-remove-bet="${index}" aria-label="Remove ${safeText(item.selection)}">×</button></strong></div>`).join("") : `<div class="aia-draft-empty">Add a number and points to build your bid</div>`}</div>
        <div class="aia-draft-totals"><span>Total : <strong>${money(total)}</strong></span><span>Left Points : <strong>${money(remaining)}</strong></span></div>
      </section>
      <button class="aia-yellow-button aia-submit-button" type="submit" ${!state.betDraft.length || unavailableMessage ? "disabled" : ""}>SUBMIT</button>
    </form>`;
}

function renderCharts() {
  return `${heading("Result chart", "Latest market results from the app's market database.")}
    <div class="filter-row">${availableMarketCategories().map(category => `<button type="button" class="filter-chip ${state.category === category ? "active" : ""}" data-category="${safeText(category)}">${safeText(category)}</button>`).join("")}<button type="button" class="text-button" data-action="refresh">↻ Auto Refresh results</button></div>
    ${marketCards(state.markets.filter(market => state.category === "Main"
      ? !/starline|gali|disawar/i.test(market.category)
      : state.category === "Starline" ? /starline/i.test(market.category) : /gali|disawar/i.test(market.category)))}
    <div class="warning-box">Market results are updated automatically.</div>`;
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
      ${bids.slice().sort((a,b) => String(b.id).localeCompare(String(a.id))).map(bid => {
        const settlement = matka60BidSettlementFor(bid);
        const outcome = settlement
          ? `${settlement.outcome}${settlement.outcome === "Won" ? ` · ${money(settlement.payout)}` : ""}`
          : "";
        return `<div class="aia-history-row"><span>${safeText(bidTime(bid))}</span><span>${safeText(bid.session || bid.payload?.[1] || "Open")}</span><span>${safeText(bid.selection || bid.payload?.[2] || "")}${outcome ? `<small> · ${safeText(outcome)}</small>` : ""}</span><span>${safeText(bid.amount ?? bid.payload?.[3] ?? "")}</span></div>`;
      }).join("")}
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
  if (state.paymentApiUrl) {
    let pendingPayment = null;
    try {
      pendingPayment = state.user ? readPendingPayment(state.user.phone) : null;
    } catch (error) {
      notify(error.message || "Could not restore payment status.", "error");
    }
    const lastStatus = pendingPayment?.lastStatus
      ? `Last gateway status: ${safeText(pendingPayment.lastStatus)}${pendingPayment.lastCheckedAt ? ` (${safeText(new Date(pendingPayment.lastCheckedAt).toLocaleString())})` : ""}.`
      : "The gateway has not confirmed this payment yet.";
    const retrySeconds = pendingPayment ? paymentRetrySeconds(pendingPayment) : 0;
    return `${heading("Deposit points", "Pay securely and points are added after the gateway confirms payment.")}
      <div class="profile-grid deposit-page-grid"><section class="panel deposit-panel"><div class="panel-heading"><h2>New payment</h2><small>Current balance: ${money(state.balance)}</small></div>
        <form id="deposit-form" class="form-stack">
          <section class="payment-details"><span class="deposit-security-icon" aria-hidden="true">₹</span><h3>Secure payment</h3><p>Choose an amount to open the payment page. Points are added only after payment is confirmed.</p></section>
          <label class="field">Points amount (₹)<input name="amount" type="number" min="1" max="1000000" step="0.01" required placeholder="Enter amount" ${retrySeconds ? "disabled" : ""}></label>
          <div class="quick-amounts">${[100,200,500,700,900,1500,2000,5000].map(amount => `<button class="quick-amount" type="button" data-amount="${amount}" ${retrySeconds ? "disabled" : ""}>₹${amount.toLocaleString("en-IN")}</button>`).join("")}</div>
          <button class="button button-primary" type="submit" ${retrySeconds ? "disabled" : ""}>Continue to secure payment <span>→</span></button>
        </form>
        ${pendingPayment && retrySeconds > 0 ? `<div class="payment-pending-card"><strong>Payment pending</strong><span>Order ${safeText(pendingPayment.orderId)}</span><p>${lastStatus} Your pending payment will keep checking automatically.</p><p>If the wallet is not updated after 30 seconds, you can start another payment. Only retry if you did not complete the first payment; if both payments succeed, both may be credited.</p><span class="payment-retry-timer" data-payment-retry-countdown data-created-at="${safeText(pendingPayment.createdAt || "")}">${`00:${String(retrySeconds).padStart(2, "0")}`}</span><button class="button button-secondary" type="button" data-action="check-pending-payment">Check payment status now</button></div>` : ""}
        ${pendingPayment ? "" : `<div class="warning-box">If payment is pending, wait for the gateway status confirmation before starting another payment.</div>`}
      </section></div>`;
  }
  let qrMarkup;
  try {
    const source = paymentQrSource();
    qrMarkup = `<img class="payment-qr-image" src="${safeText(source)}" alt="Scan this payment QR code">`;
  } catch (error) {
    qrMarkup = `<div class="payment-qr-placeholder"><strong>Payment QR unavailable</strong><span>${safeText(error.message)}</span></div>`;
  }
  const upiMarkup = state.paymentUpiId
    ? `<div class="payment-upi-row"><span><small>UPI ID</small><strong>${safeText(state.paymentUpiId)}</strong></span><button class="button button-secondary" type="button" data-action="copy-upi">Copy</button></div>`
    : `<div class="payment-setting-warning">UPI ID has not been configured in Firebase (Admin/Admin/upi_id).</div>`;
  return `${heading("Deposit points", "Send a request to add points to your account.")}
    <div class="profile-grid deposit-page-grid"><section class="panel deposit-panel"><div class="panel-heading"><h2>New deposit request</h2><small>Current balance: ${money(state.balance)}</small></div>
      <form id="deposit-form" class="form-stack">
        <section class="payment-details"><span class="deposit-security-icon" aria-hidden="true">₹</span><h3>Pay using UPI</h3>${qrMarkup}${upiMarkup}<p>Scan the QR code or copy the UPI ID to complete your payment.</p></section>
        <label class="field">Points amount (₹)<input name="amount" type="number" min="1" step="1" required placeholder="Enter amount"></label>
        <div class="quick-amounts">${[500,700,900,1500,2000,2500,3000,5000].map(amount => `<button class="quick-amount" type="button" data-amount="${amount}">₹${amount.toLocaleString("en-IN")}</button>`).join("")}</div>
        <label class="field">Transaction ID (optional)<input name="reference" type="text" maxlength="100" autocomplete="off" placeholder="Enter your UPI transaction ID"></label>
        <button class="button button-primary" type="submit">I have paid — submit request <span>→</span></button>
      </form>
      <div class="warning-box">After the administrator verifies your payment, the approved points will be added to your balance within a few minutes. Points are not credited before approval.</div>
    </section></div>`;
}

function timeMinutes(value) {
  const match = String(value || "").match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour <= 23 && minute <= 59 ? hour * 60 + minute : null;
}

function formatTime12(value) {
  const minutes = timeMinutes(value);
  if (minutes === null) return "—";
  const hour24 = Math.floor(minutes / 60);
  const hour = hour24 % 12 || 12;
  return `${String(hour).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")} ${hour24 >= 12 ? "PM" : "AM"}`;
}

function withdrawalWindowAt(date = marketNow()) {
  const minute = date.getHours() * 60 + date.getMinutes();
  const windows = Object.entries(state.withdrawalWindows).map(([period, window]) => ({
    period,
    open: window.open,
    close: window.close,
    openMinute: timeMinutes(window.open),
    closeMinute: timeMinutes(window.close)
  })).filter(window => window.openMinute !== null && window.closeMinute !== null
    && window.openMinute !== window.closeMinute);
  const active = windows.find(window => window.openMinute < window.closeMinute
    ? minute >= window.openMinute && minute < window.closeMinute
    : minute >= window.openMinute || minute < window.closeMinute);
  const next = active || windows.find(window => window.openMinute > minute) || windows[0] || null;
  return { open: Boolean(active), active, next, windows };
}

function renderWithdrawalTiming(access) {
  const window = access.active || access.next;
  if (!window) return `<p class="withdrawal-balance-hours">Withdrawal hours have not been configured.</p>`;
  return `<div class="withdrawal-balance-hours"><span><small>Open Time:</small> ${formatTime12(window.open)}</span><i aria-hidden="true">|</i><span><small>Close Time:</small> ${formatTime12(window.close)}</span></div>`;
}

function renderWithdraw() {
  const saved = savedWithdrawalDetails();
  const access = withdrawalWindowAt();
  const hasSavedDetails = Boolean(saved.holderName || saved.phonePay || saved.googlePay);
  return `<header class="withdraw-page-header"><button type="button" data-action="withdraw-back" aria-label="Back">‹</button><h1>Withdraw</h1><span></span></header>
    <div class="profile-grid withdraw-page-grid"><section class="panel withdraw-panel"><div class="panel-heading"><h2>New withdrawal request</h2><small>Available: ${money(state.balance)}</small></div>
      <section class="withdrawal-balance-card"><div><small>AVAILABLE BALANCE</small><strong>${money(state.balance)}</strong></div><span class="withdrawal-status-pill ${access.open ? "open" : "closed"}">${access.open ? "OPEN" : "CLOSED"}</span>${renderWithdrawalTiming(access)}</section>
      <form id="withdraw-form" class="form-stack">
        <section class="withdrawal-amount-card"><h2><span aria-hidden="true">₹</span> Withdrawal Amount</h2>
          <label class="field withdrawal-amount-field"><span class="hidden">Amount (₹)</span><input name="amount" type="number" min="1" step="1" value="${safeText(saved.amount || "")}" required placeholder="Enter amount here" ${access.open ? "" : "disabled"}></label>
          <div class="withdrawal-limits"><span>↓ &nbsp;Min: ${state.minimumWithdrawal ? money(state.minimumWithdrawal) : "—"}</span><span>↑ &nbsp;Max: ${money(state.balance)}</span></div>
          <button class="button button-primary withdrawal-submit" type="submit" ${access.open ? "" : "disabled"}><span aria-hidden="true">✥</span> Submit Withdrawal</button>
          <div class="withdrawal-rules"><h3><span aria-hidden="true">☷</span> Withdraw Rules</h3><p><b>• &nbsp;Withdraw Money Rules</b><br>${state.minimumWithdrawal ? `Minimum Withdrawal: At least ${money(state.minimumWithdrawal)} per request.` : "Withdrawal requests must be within your available wallet balance."}${state.withdrawTiming ? `<br><br>${safeText(state.withdrawTiming)}` : ""}</p></div>
        </section>
        <details class="withdrawal-account-details" ${state.withdrawalDetailsVisible || hasSavedDetails ? "open" : ""}>
          <summary><span aria-hidden="true">▣</span><span><strong>${hasSavedDetails ? "Withdrawal account details" : "Add withdrawal account details"}</strong><small>${hasSavedDetails ? "Saved in this browser session" : "Bank account, PhonePe, or Google Pay"}</small></span><b aria-hidden="true">⌄</b></summary>
          <div class="withdrawal-account-fields">
            <label class="field">Account holder name<input name="holderName" type="text" maxlength="80" value="${safeText(saved.holderName || "")}" placeholder="Name on bank account" ${access.open ? "" : "disabled"}></label>
            <label class="field">IFSC code<input name="ifsc" type="text" maxlength="20" value="${safeText(saved.ifsc || "")}" placeholder="Required for bank transfer" ${access.open ? "" : "disabled"}></label>
            <label class="field">Account number<input name="accountNumber" type="text" maxlength="40" value="${safeText(saved.accountNumber || "")}" placeholder="Required for bank transfer" ${access.open ? "" : "disabled"}></label>
            <label class="field">PhonePe number<input name="phonePay" type="tel" maxlength="20" value="${safeText(saved.phonePay || "")}" placeholder="Optional" ${access.open ? "" : "disabled"}></label>
            <label class="field">Google Pay number<input name="googlePay" type="tel" maxlength="20" value="${safeText(saved.googlePay || "")}" placeholder="Optional" ${access.open ? "" : "disabled"}></label>
          </div>
        </details>
      </form><div class="withdrawal-security-note"><span aria-hidden="true">⬟</span><b>Saved bank details will be verified before submitting your withdrawal request.</b></div>
      ${state.withdrawalDialogVisible && !access.open ? `<div class="mama-dialog-backdrop withdrawal-dialog-backdrop" role="presentation"><section class="mama-dialog withdrawal-closed-dialog" role="dialog" aria-modal="true" aria-labelledby="withdrawal-closed-title"><div class="withdrawal-info-icon" aria-hidden="true">i</div><div class="mama-dialog-body"><h2 id="withdrawal-closed-title">Cannot withdraw at this time</h2>${access.next ? `<p><strong>Open Time:</strong> ${formatTime12(access.next.open)}<br><strong>Close Time:</strong> ${formatTime12(access.next.close)}</p>` : `<p>Withdrawal times have not been configured.</p>`}<button class="button button-primary" type="button" data-action="dismiss-withdrawal-dialog">OK</button></div></section></div>` : ""}
      ${state.insufficientWithdrawalAmount !== null ? `<div class="mama-dialog-backdrop withdrawal-dialog-backdrop" role="presentation"><section class="mama-dialog insufficient-balance-dialog" role="dialog" aria-modal="true" aria-labelledby="insufficient-balance-title"><div class="insufficient-balance-icon" aria-hidden="true">▣</div><div class="mama-dialog-body"><h2 id="insufficient-balance-title">Insufficient Balance</h2><p>Your wallet balance is lower than the requested withdrawal amount.</p><div class="insufficient-balance-summary"><span>Requested Amount <b>${money(state.insufficientWithdrawalAmount)}</b></span><span>Available Balance <b>${money(state.balance)}</b></span></div><div class="insufficient-balance-actions"><button class="button button-primary" type="button" data-action="add-withdrawal-details">Add withdrawal details</button><button class="button button-secondary" type="button" data-action="dismiss-insufficient-balance">OK</button></div></div></section></div>` : ""}
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
  return `<section class="policy-page"><header class="policy-page-heading"><p>ACCOUNT INFORMATION</p><h1>Privacy &amp; policy</h1><span>Privacy information published for A2 MORNING.</span></header>${paragraphs.length
    ? `<section class="panel policy-content">${paragraphs.map(paragraph => `<p>${safeText(paragraph)}</p>`).join("")}</section>`
    : `<div class="empty-state"><strong>Policy is not available</strong>The administrator has not published privacy information yet.</div>`}</section>`;
}

function renderHowTo() {
  return `${heading("How to play", "A quick guide to the market and points flow.")}
    <div class="two-column">
      <section class="panel"><div class="panel-heading"><h2>Place a bid</h2></div>
        <div class="activity-list">
          ${[
            ["01", "Choose a market category", "Open Markets and choose Main, Starline or Super Jackpot."],
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
      </form></section>${window.ReactNativeWebView ? `<section class="panel"><div class="panel-heading"><h2>Push notifications</h2></div><p class="muted">Enable notifications to receive updates from A2 MORNING on this device.</p><button class="button button-secondary" type="button" data-action="enable-push">Enable notifications</button></section>` : ""}</section>
      <section class="panel"><div class="panel-heading"><h2>Change password</h2></div><form id="password-form" class="form-stack">
        <label class="field">Current password<input name="currentPassword" type="password" required autocomplete="current-password"></label>
        <label class="field">New password<input name="newPassword" type="password" minlength="8" required autocomplete="new-password"></label>
        <label class="field">Confirm new password<input name="confirmPassword" type="password" minlength="8" required autocomplete="new-password"></label>
        <button class="button button-secondary" type="submit">Update password</button><p class="inline-message" id="password-message"></p>
      </form></section></div>`;
}

function dbKey(value) {
  return String(value).replace(/[.#$\[\]/]/g, "_");
}

async function submitBid(event) {
  event.preventDefault();
  if (state.accountBlocked) {
    notify("This account is blocked from placing games. Contact support for help.", "error");
    return;
  }
  if (state.maintenance) {
    notify("Bidding is unavailable during maintenance.", "error");
    return;
  }
  const market = state.markets.find(item => item.name === state.selectedMarket);
  const session = state.selectedSession;
  if (!(session === "Open" ? state.openBets : state.closeBets)) {
    notify(`The ${session.toLowerCase()} session is currently unavailable.`, "error");
    return;
  }
  if (state.betDraft.some(item => !Number.isFinite(item.amount)
    || item.amount <= 0
    || (state.minimumEntry > 0 && item.amount < state.minimumEntry)
    || (state.maximumEntry > 0 && item.amount > state.maximumEntry))) {
    notify("One or more bid amounts are outside the current per-number limits.", "error");
    return;
  }
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

async function submitMatka60Bid(event) {
  event.preventDefault();
  if (!MATKA60_SERVER_AUTHORIZED_BETS_READY || !MATKA60_SERVER_API_READY) {
    notify("Matka 60 is paused until server-authorized bets and database write rules are configured.", "error");
    return;
  }
  if (!state.matka60SessionToken) {
    notify("Please sign in again to enable server-authorized Matka 60 betting.", "error");
    return;
  }
  if (state.accountBlocked) {
    notify("This account is blocked from placing games. Contact support for help.", "error");
    return;
  }
  if (state.maintenance) {
    notify("Bidding is unavailable during maintenance.", "error");
    return;
  }
  if (!state.matka60ClockSynced || state.matka60ResultsError) {
    notify("The shared game feed is unavailable. Betting is paused.", "error");
    return;
  }
  const serverNow = matka60ServerNow();
  const currentPeriodId = serverNow === null ? "" : matka60PeriodId(serverNow);
  const secondsLeft = serverNow === null ? 0 : Math.ceil((60000 - (serverNow % 60000)) / 1000);
  const selections = state.matka60BetType === "ank"
    ? [state.matka60Digit]
    : [...state.matka60SelectedPannas];
  const amount = Number(query("#matka60-amount")?.value ?? state.matka60Amount);
  state.matka60Amount = amount;
  const gameType = `Matka 60 ${state.matka60BetType === "ank" ? "Ank" : "Panna"}`;
  const requestFingerprint = JSON.stringify({ gameType, selections, amount });
  const pendingRequest = state.matka60PendingRequest;
  if (pendingRequest && pendingRequest.fingerprint !== requestFingerprint) {
    notify("A previous bet may still be processing. Retry the same selection before starting another bet.", "error");
    return;
  }
  const replayingPendingRequest = Boolean(pendingRequest);
  const periodId = replayingPendingRequest ? pendingRequest.periodId : currentPeriodId;
  if (!periodId || (!replayingPendingRequest && secondsLeft <= 0)) {
    notify("This round has ended. Wait for the next round to place a bet.", "error");
    return;
  }
  if (!selections.length || !Number.isInteger(amount) || amount <= 0
    || (!replayingPendingRequest && state.minimumEntry > 0 && amount < state.minimumEntry)
    || (!replayingPendingRequest && state.maximumEntry > 0 && amount > state.maximumEntry)) {
    notify("Choose valid number(s) and points within the current per-number limits.", "error");
    return;
  }
  const total = amount * selections.length;
  if (!replayingPendingRequest && total > state.balance) {
    notify("There are not enough points in your balance for these numbers.", "error");
    return;
  }
  const button = event.target.querySelector('button[type="submit"]');
  setBusy(button, true, "Submitting bet…");
  try {
    if (!replayingPendingRequest) {
      const latestServerNow = matka60ServerNow();
      if (latestServerNow === null || matka60PeriodId(latestServerNow) !== periodId
        || Math.ceil((60000 - (latestServerNow % 60000)) / 1000) <= 0) {
        throw new Error("This round has ended. Wait for the next round to place a bet.");
      }
    }
    if (!state.matka60PendingRequest) {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = [...bytes].map(value => value.toString(16).padStart(2, "0")).join("");
      state.matka60PendingRequest = {
        fingerprint: requestFingerprint,
        periodId,
        requestId: `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
      };
    }
    const response = await matka60ApiRequest("placeBet", {
      requestId: state.matka60PendingRequest.requestId,
      periodId,
      gameType,
      digit: state.matka60Digit,
      selections,
      amount
    }, state.matka60SessionToken);
    const createdBids = Array.isArray(response.bets) ? response.bets : [];
    if (!createdBids.length || !Number.isFinite(Number(response.balance))) {
      throw new Error("The server response did not confirm the saved Matka 60 bet.");
    }
    state.balance = Number(response.balance);
    const existingBidIds = new Set(state.bids.map(bid => bid.id));
    state.bids.push(...createdBids.filter(bid => !existingBidIds.has(bid.id)));
    if (response.transaction?.id &&
        !state.accountTransactions.some(transaction => transaction.id === response.transaction.id)) {
      state.accountTransactions.push(response.transaction);
    }
    state.matka60PendingRequest = null;
    updatePointsHistory();
    state.matka60SelectedPannas = [];
    notify(`${createdBids.length} Matka 60 bet${createdBids.length === 1 ? "" : "s"} submitted successfully.`);
    await renderPage();
  } catch (error) {
    if (error.status >= 400 && error.status < 500) state.matka60PendingRequest = null;
    notify(error.message || "Unable to submit the Matka 60 bet.", "error");
  } finally {
    setBusy(button, false);
  }
}

function addBetDraft() {
  const selectionField = query("#bet-selection");
  const secondarySelectionField = query("#bet-selection-secondary");
  const amountField = query("#bet-amount");
  const selection = String(selectionField?.value || "").trim();
  const secondarySelection = String(secondarySelectionField?.value || "").trim();
  const amount = Number(amountField?.value);
  const total = state.betDraft.reduce((sum, item) => sum + item.amount, 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    notify("Enter a number and valid points amount.", "error");
    return;
  }
  let selections;
  try {
    selections = buildBetSelections(state.selectedGame, state.selectedSession, selection, secondarySelection);
  } catch (error) {
    notify(error.message || "Enter a valid number for the selected game type.", "error");
    selectionField?.focus();
    return;
  }
  if (state.minimumEntry > 0 && amount < state.minimumEntry) {
    window.alert(`Minimum points per number: ${state.minimumEntry}${state.maximumEntry > 0 ? `\nMaximum points per number: ${state.maximumEntry}` : ""}`);
    return;
  }
  if (state.maximumEntry > 0 && amount > state.maximumEntry) {
    window.alert(`Maximum points per number: ${state.maximumEntry}${state.minimumEntry > 0 ? `\nMinimum points per number: ${state.minimumEntry}` : ""}`);
    return;
  }
  const requiredPoints = amount * selections.length;
  if (requiredPoints > state.balance - total) {
    window.alert(`This amount is greater than your remaining wallet balance of ${money(state.balance - total)}.`);
    return;
  }
  state.betDraft.push(...selections.map(number => ({ selection: number, amount })));
  if (selections.length > 1) {
    notify(`${selections.length} numbers added. Total stake: ${money(requiredPoints)}.`);
  }
  renderPage();
  query("#bet-selection")?.focus();
}

async function submitRequest(event, type) {
  event.preventDefault();
  const form = event.target;
  const values = new FormData(form);
  const amount = Number(values.get("amount"));
  const isDeposit = type === "deposit";
  if (!isDeposit && !withdrawalWindowAt().open) {
    state.withdrawalDialogVisible = true;
    await renderPage();
    return;
  }
  const destination = isDeposit ? "UPI QR" : String(values.get("method") || "").trim();
  const transactionId = String(values.get("reference") || "").trim();
  const holderName = String(values.get("holderName") || "").trim();
  const ifsc = String(values.get("ifsc") || "").trim();
  const accountNumber = String(values.get("accountNumber") || "").trim();
  const phonePay = String(values.get("phonePay") || "").trim();
  const googlePay = String(values.get("googlePay") || "").trim();
  if (!Number.isFinite(amount) || amount <= 0) {
    notify("Complete the required fields with a valid amount.", "error");
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
        transactionId,
        amount,
        currentBalance,
        ""
      ]);
      updates[`${DATABASE_ROOTS.deposits}/${key}`] = requestValue;
    } else {
      if (amount > currentBalance) {
        state.balance = currentBalance;
        state.insufficientWithdrawalAmount = amount;
        await renderPage();
        return;
      }
      const minimum = Number(decodeFirebaseValue(await dbGet(`${DATABASE_ROOTS.settings}/MW`)) || 0);
      state.minimumWithdrawal = Number.isFinite(minimum) ? Math.max(0, minimum) : 0;
      state.balance = currentBalance;
      if (state.minimumWithdrawal && amount < state.minimumWithdrawal) {
        throw new Error(`Minimum withdrawal amount is ₹${state.minimumWithdrawal}.`);
      }
      if (!holderName && !phonePay && !googlePay) {
        state.withdrawalDetailsVisible = true;
        await renderPage();
        notify("Amount is eligible. Add your withdrawal account details to continue.");
        return;
      }
      if (holderName && (!ifsc || !accountNumber)) {
        state.withdrawalDetailsVisible = true;
        await renderPage();
        notify("Enter the IFSC code and account number for bank withdrawals.", "error");
        return;
      }
      if (!withdrawalWindowAt().open) {
        state.withdrawalDialogVisible = true;
        await renderPage();
        return;
      }
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
      destination: isDeposit ? transactionId : phonePay || googlePay || accountNumber,
      status: "Pending",
      createdAt: now.toISOString()
    };
    if (isDeposit) state.depositHistory.push(entry);
    else {
      state.balance = currentBalance - amount;
      state.withdrawalHistory.push(entry);
    }
    state.pointsHistory.push(entry);
    notify(isDeposit
      ? "Payment request sent. Points are added after admin approval."
      : "Withdrawal request sent.");
    await renderPage();
  } catch (error) {
    notify(error.message || "Unable to send your request.", "error");
  } finally {
    setBusy(button, false);
  }
}

async function startPayment(event) {
  event.preventDefault();
  if (!state.user || !/^\d{10}$/.test(state.user.phone)) {
    notify("Sign in before starting a payment.", "error");
    return;
  }
  let pending;
  try {
    pending = readPendingPayment(state.user.phone);
  } catch (error) {
    notify(error.message || "Could not read the pending payment.", "error");
    return;
  }
  if (pending && paymentRetrySeconds(pending) > 0) {
    notify(`You can start another payment in ${paymentRetrySeconds(pending)} seconds.`, "error");
    return;
  }
  const phone = state.user.phone;
  const amountText = String(new FormData(event.target).get("amount") || "").trim();
  const amount = Number(amountText);
  if (!/^\d+(?:\.\d{1,2})?$/.test(amountText) || !Number.isFinite(amount) ||
      amount < 1 || amount > 1000000) {
    notify("Enter an amount from ₹1 to ₹10,00,000 with at most two decimals.", "error");
    return;
  }
  const button = event.target.querySelector("button[type=submit]");
  setBusy(button, true, "Creating secure payment…");
  try {
    const result = await paymentApiRequest({ action: "create", phone, amount: amountText });
    let checkout;
    try {
      checkout = new URL(result.checkoutUrl);
    } catch {
      throw new Error("The payment service returned an invalid checkout link.");
    }
    if (checkout.protocol !== "https:" || !result.orderId || !result.pollToken) {
      throw new Error("The payment service returned incomplete or insecure order details.");
    }
    const order = {
      phone,
      orderId: String(result.orderId),
      pollToken: String(result.pollToken),
      checkoutUrl: checkout.href,
      amount,
      createdAt: new Date().toISOString()
    };
    savePendingPayment(order);
    startPaymentStatusPolling(order, false);
    window.location.assign(checkout.href);
    notify("Payment page opened. Waiting for gateway confirmation.");
  } catch (error) {
    notify(error.message || "Could not start the payment.", "error");
  } finally {
    setBusy(button, false);
  }
}

function retryPendingPayment(order) {
  const seconds = paymentRetrySeconds(order);
  if (seconds > 0) {
    notify(`You can retry the secure payment in ${seconds} seconds.`, "error");
    return;
  }
  const form = query("#deposit-form");
  const amount = query('#deposit-form input[name="amount"]');
  if (!form || !amount) {
    notify("Open Deposit points to start a new payment.", "error");
    return;
  }
  amount.value = String(order.amount);
  if (typeof form.requestSubmit === "function") form.requestSubmit();
  else form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
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
    await dbPutAndVerify(`${DATABASE_ROOTS.users}/${phone}/name`, name);
    state.user.name = name;
    localStorage.setItem("a2MorningUser", JSON.stringify(state.user));
    query("#header-name").textContent = name;
    query("#header-avatar").textContent = name.charAt(0).toUpperCase();
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
    await dbPutAndVerify(`${DATABASE_ROOTS.users}/${phone}/password`, newPassword);
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
    title: "A2 MORNING",
    text: "Open A2 MORNING",
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
  const target = event.target.closest("[data-page], [data-auth-mode], [data-select-game], [data-category], [data-action], [data-amount], [data-open-market], [data-market-result], [data-drawer-toggle], [data-session], [data-number], [data-remove-bet], [data-expert-period], [data-unlock-guess], [data-matka60-type], [data-matka60-digit], [data-matka60-number], [data-matka60-quick-add], [data-matka60-history], .support-sheet-backdrop");
  if (!target) return;
  if (target.classList.contains("support-sheet-backdrop") && event.target !== target) return;
  if (target.classList.contains("support-sheet-backdrop") && event.target === target) {
    state.supportDialogVisible = false;
    renderPage();
    return;
  }
  if (target.hasAttribute("data-drawer-toggle")) {
    if (state.page === "home") {
      query("#sidebar").classList.add("open");
      query("#drawer-scrim").classList.add("visible");
    } else {
      handleAppBack();
    }
    return;
  }
  if (target.dataset.authMode) {
    showAuth(target.dataset.authMode);
    return;
  }
  if (target.dataset.action === "close-support") {
    state.supportDialogVisible = false;
    renderPage();
    return;
  }
  if (target.dataset.action === "open-feature-markets") {
    state.category = target.dataset.featureCategory;
    if (state.category === "Gali / Disawar") {
      state.matka60HistoryTab = "game";
      setPage("matka60");
      return;
    }
    state.featureMarketPage = true;
    setPage("markets");
    return;
  }
  if (target.dataset.action === "matka60-back") {
    handleAppBack();
    return;
  }
  if (target.dataset.action === "matka60-help") {
    state.matka60HelpVisible = !state.matka60HelpVisible;
    void renderPage();
    return;
  }
  if (target.dataset.matka60Type) {
    state.matka60BetType = target.dataset.matka60Type;
    state.matka60SelectedPannas = [];
    void renderPage();
    return;
  }
  if (target.dataset.matka60Digit !== undefined) {
    state.matka60Digit = target.dataset.matka60Digit;
    state.matka60SelectedPannas = [];
    void renderPage();
    return;
  }
  if (target.dataset.matka60Number !== undefined) {
    const number = target.dataset.matka60Number;
    if (state.matka60BetType === "ank") {
      state.matka60Digit = number;
    } else if (state.matka60SelectedPannas.includes(number)) {
      state.matka60SelectedPannas = state.matka60SelectedPannas.filter(item => item !== number);
    } else {
      state.matka60SelectedPannas = [...state.matka60SelectedPannas, number];
    }
    void renderPage();
    return;
  }
  if (target.dataset.matka60QuickAdd !== undefined) {
    const amount = Number(query("#matka60-amount")?.value || state.matka60Amount);
    state.matka60Amount = (Number.isFinite(amount) ? amount : 0) + Number(target.dataset.matka60QuickAdd);
    const amountInput = query("#matka60-amount");
    if (amountInput) amountInput.value = String(state.matka60Amount);
    return;
  }
  if (target.dataset.matka60History) {
    state.matka60HistoryTab = target.dataset.matka60History;
    void renderPage();
    return;
  }
  if (target.dataset.action === "open-expert-guessing") {
    state.expertGuessingPeriod = "day";
    const loading = loadExpertGuessing(true);
    setPage("expert-guessing");
    void loading.then(renderPage).catch(error => {
      notify(error.message || "Could not load expert numbers.", "error");
      renderPage();
    });
    return;
  }
  if (target.dataset.action === "refresh-expert-guessing") {
    const loading = loadExpertGuessing(true);
    renderPage();
    void loading.then(renderPage).catch(error => {
      notify(error.message || "Could not load expert numbers.", "error");
      renderPage();
    });
    return;
  }
  if (target.dataset.action === "expert-back") {
    handleAppBack();
    return;
  }
  if (target.dataset.action === "dismiss-market-closed") {
    state.closedMarket = null;
    renderPage();
    return;
  }
  if (target.dataset.action === "dismiss-withdrawal-dialog") {
    state.withdrawalDialogVisible = false;
    renderPage();
    return;
  }
  if (target.dataset.action === "withdraw-back") {
    handleAppBack();
    return;
  }
  if (target.dataset.action === "dismiss-insufficient-balance") {
    state.insufficientWithdrawalAmount = null;
    renderPage();
    return;
  }
  if (target.dataset.action === "add-withdrawal-details") {
    state.insufficientWithdrawalAmount = null;
    state.withdrawalDetailsVisible = true;
    void renderPage().then(() => {
      query(".withdrawal-account-details")?.scrollIntoView({ behavior: "smooth", block: "center" });
      query('[name="holderName"]')?.focus({ preventScroll: true });
    });
    return;
  }
  if (target.dataset.expertPeriod) {
    state.expertGuessingPeriod = target.dataset.expertPeriod;
    renderPage();
    return;
  }
  if (target.dataset.unlockGuess) {
    const market = state.markets.find(item => item.id === target.dataset.unlockGuess);
    if (!market) {
      notify("This market is no longer available. Refresh and try again.", "error");
      return;
    }
    const guess = expertGuessFor(market);
    if (!guess || !Object.values(guess).some(values => values.length)) {
      notify("Expert numbers have not been published for this market yet.", "error");
      return;
    }
    state.selectedGuessMarket = market.id;
    state.revealedGuess = getRevealedGuess(market);
    setPage("guess-scratch");
    return;
  }
  if (target.dataset.action === "scratch-guess") {
    const market = state.markets.find(item => item.id === state.selectedGuessMarket);
    const guess = market ? expertGuessFor(market) : null;
    if (!market || !guess || !Object.values(guess).some(values => values.length)) {
      notify("Expert numbers are no longer available for this market.", "error");
      return;
    }
    try {
      localStorage.setItem(guessRevealKey(market), JSON.stringify({ revealedAt: Date.now(), guess }));
      state.revealedGuess = guess;
      renderPage();
    } catch (error) {
      notify(`Could not save the revealed numbers: ${error.message || "Storage is unavailable."}`, "error");
    }
    return;
  }
  if (target.dataset.page) {
    if (target.dataset.page === "support") {
      state.supportDialogVisible = true;
      query("#sidebar").classList.remove("open");
      query("#drawer-scrim").classList.remove("visible");
      void renderPage();
      return;
    }
    setPage(target.dataset.page);
    return;
  }
  if (target.dataset.action === "exit-dialog-close" || target.dataset.action === "exit-dialog-cancel") {
    closeExitDialog();
    return;
  }
  if (target.dataset.action === "exit-dialog-confirm") {
    closeExitDialog();
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: "exit-app" }));
    } else {
      notify("You can close this browser tab to exit the preview.");
    }
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
    const selection = query("#bet-selection");
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
    const amountField = query('input[name="amount"]', target.closest("section"));
    if (amountField) amountField.value = target.dataset.amount;
    return;
  }
  if (target.dataset.action === "refresh") {
    refreshAll();
    return;
  }
  if (target.dataset.action === "refresh-webviewer") {
    const frame = query(".result-webviewer");
    if (frame) frame.src = state.webViewerUrl;
    return;
  }
  if (target.dataset.action === "enable-push") {
    if (!window.ReactNativeWebView) {
      notify("Push notifications are available in the native app.", "error");
      return;
    }
    window.__a2PushResult = result => {
      if (result.enabled) notify("Push notifications are enabled on this device.");
      else notify(result.error || "Push notifications were not enabled.", "error");
    };
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: "enable-push" }));
    return;
  }
  if (target.dataset.action === "copy-upi") {
    void copyTextToClipboard(state.paymentUpiId)
      .then(() => notify("UPI ID copied."))
      .catch(error => notify(error.message || "Could not copy the UPI ID.", "error"));
    return;
  }
  if (target.dataset.action === "check-pending-payment") {
    try {
      const order = readPendingPayment(state.user?.phone || "");
      if (!order) {
        notify("There is no pending payment to check.", "error");
        return;
      }
      startPaymentStatusPolling(order, false);
      notify("Checking payment status with the gateway.");
    } catch (error) {
      notify(error.message || "Could not check payment status.", "error");
    }
    return;
  }
  if (target.dataset.action === "deposit-whatsapp") {
    try {
      openWhatsApp(`Hello, I submitted a payment request for ${query('#deposit-form input[name="amount"]')?.value || "points"} points. My phone number is ${state.user?.phone || ""}. The points have not been added yet. I will attach my payment screenshot here.`);
    } catch (error) {
      notify(error.message || "Unable to open WhatsApp.", "error");
    }
    return;
  }
  if (target.dataset.action === "forgot-password") {
    const phone = query("#auth-phone").value.replace(/\D/g, "");
    if (!/^\d{10}$/.test(phone)) {
      notify("Enter your 10-digit phone number first.", "error");
      query("#auth-phone").focus();
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
      state.supportDialogVisible = false;
      void renderPage();
      openWhatsApp("Hello, I need help with my A2 MORNING account.");
    } catch (error) {
      notify(error.message || "Unable to open WhatsApp.", "error");
    }
    return;
  }
  if (target.dataset.action === "open-telegram") {
    try {
      state.supportDialogVisible = false;
      void renderPage();
      openExternalUrl(state.telegramUrl, "Telegram");
    } catch (error) {
      notify(error.message || "Unable to open Telegram.", "error");
    }
    return;
  }
  if (target.dataset.action === "open-results-website" || target.dataset.action === "open-website") {
    query("#sidebar").classList.remove("open");
    query("#drawer-scrim").classList.remove("visible");
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
  if (target.dataset.action === "retry-pending-payment") {
    try {
      const order = readPendingPayment(state.user?.phone || "");
      if (!order) {
        notify("There is no pending payment to retry.", "error");
        return;
      }
      retryPendingPayment(order);
    } catch (error) {
      notify(error.message || "Could not reopen the pending payment.", "error");
    }
    return;
  }
  if (target.dataset.action === "share-app") {
    query("#sidebar").classList.remove("open");
    query("#drawer-scrim").classList.remove("visible");
    void shareApp();
    return;
  }
  if (target.dataset.action === "change-password") {
    setPage("profile");
    window.setTimeout(() => {
      const passwordForm = query("#password-form");
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
        state.closedMarket = market;
        renderPage();
        return;
      }
      state.closedMarket = null;
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
  if (event.target.id === "matka60-bet-form") submitMatka60Bid(event);
  if (event.target.id === "deposit-form") {
    if (state.paymentApiUrl) void startPayment(event);
    else void submitRequest(event, "deposit");
  }
  if (event.target.id === "withdraw-form") submitRequest(event, "withdraw");
  if (event.target.id === "profile-form") saveProfile(event);
  if (event.target.id === "password-form") changePassword(event);
}

async function copyTextToClipboard(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const input = document.createElement("textarea");
  input.value = value;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.append(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  if (!copied) throw new Error("Clipboard access is unavailable on this device.");
}

document.addEventListener("click", handleClick);
document.addEventListener("submit", handleSubmit);
window.setInterval(updatePaymentRetryCountdown, 1000);
window.setInterval(updateMatka60Clock, 250);
document.addEventListener("change", event => {
  if (event.target.matches('#bid-form select[name="market"]')) {
    state.selectedMarket = event.target.value;
    renderPage();
  }
});
document.addEventListener("input", event => {
  if (event.target.id === "matka60-amount") {
    state.matka60Amount = Number(event.target.value);
  }
});
query("#logout-button").addEventListener("click", logout);
query("#menu-toggle").addEventListener("click", () => {
  if (state.page !== "home") {
    handleAppBack();
    return;
  }
  const open = !query("#sidebar").classList.contains("open");
  query("#sidebar").classList.toggle("open", open);
  query("#drawer-scrim").classList.toggle("visible", open);
});
query("#drawer-scrim").addEventListener("click", () => {
  query("#sidebar").classList.remove("open");
  query("#drawer-scrim").classList.remove("visible");
});
query("#exit-dialog").addEventListener("click", event => {
  if (event.target === event.currentTarget) closeExitDialog();
});
query("#sidebar").addEventListener("click", event => {
  if (event.target.closest("[data-page]")) query("#drawer-scrim").classList.remove("visible");
});
query("#current-year").textContent = new Date().getFullYear();

function notifyNativeAppReady() {
  window.ReactNativeWebView?.postMessage(JSON.stringify({ type: "app-ready" }));
}

function showStartupError(error) {
  query("#startup-view").classList.remove("hidden");
  query("#auth-view").classList.add("hidden");
  query("#app-view").classList.add("hidden");
  query("#startup-message").textContent = `Could not verify your saved account: ${error.message || "Please check your connection and try again."}`;
  query("#startup-retry").classList.remove("hidden");
}

async function startApplication() {
  query("#startup-view").classList.remove("hidden");
  query("#startup-message").textContent = "Checking your account…";
  query("#startup-retry").classList.add("hidden");

  const sharedUserSession = getSharedSessionFromUrl();
  if (sharedUserSession) {
    state.user = {
      phone: sharedUserSession.phone,
      name: sharedUserSession.name
    };
    localStorage.setItem("a2MorningUser", JSON.stringify(state.user));
  } else if (!restoreSession()) {
    showAuth("signup");
    notifyNativeAppReady();
    return;
  }
  try {
    if (!await restoredFirebasePhone(state.user.phone)) {
      localStorage.removeItem("a2MorningUser");
      state.user = null;
      showAuth("login");
      notifyNativeAppReady();
      return;
    }
  } catch (error) {
    showStartupError(error);
    notifyNativeAppReady();
    return;
  }
  restoreMatka60Session(state.user.phone);

  void loadAdminSettings().catch(error => {
    notify(error.message || "Unable to load support settings.", "error");
  });
  try {
    await enterApp(true);
  } catch (error) {
    showStartupError(error);
  } finally {
    notifyNativeAppReady();
  }
}

query("#startup-retry").addEventListener("click", () => void startApplication());
void startApplication();
