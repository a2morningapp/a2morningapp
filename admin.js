const firebaseConfig = {
  apiKey: "AIzaSyDztx_uEYlkfpthoEJSzwJY45ehlIMbjMw",
  authDomain: "a2morning-in-website-new-db.firebaseapp.com",
  databaseURL: "https://a2morning-in-website-new-db-default-rtdb.firebaseio.com",
  projectId: "a2morning-in-website-new-db",
  storageBucket: "a2morning-in-website-new-db.firebasestorage.app",
  messagingSenderId: "377129823562",
  appId: "1:377129823562:web:32d90bd8964bf040a225b3",
  measurementId: "G-5GXYJREWR1",
};
const expertGuessingFirebaseConfig = {
  apiKey: "AIzaSyCGqJ1XvEYbgJ_eN5OEuzAymc3E4wKr8eI",
  authDomain: "a2morning-web-result.firebaseapp.com",
  databaseURL: "https://a2morning-web-result-default-rtdb.firebaseio.com",
  projectId: "a2morning-web-result",
  storageBucket: "a2morning-web-result.firebasestorage.app",
  messagingSenderId: "807940358876",
  appId: "1:807940358876:web:37d5de4963837b8783aa19",
  measurementId: "G-FD7MK1CWCK",
};
const resultChartDatabaseUrl = expertGuessingFirebaseConfig.databaseURL;

// The REST API key stays in Vercel environment variables; browser sends use the same-origin API.
const BROADCAST_ENDPOINT = new URL("/api/onesignal", window.location.origin).href;
let broadcastSessionEstablished = false;
// Push player IDs live on a2moring (not the main website data tree).
const PUSH_HUB_CONFIG = {
  apiKey: "AIzaSyB8nW1wxOLhTYBj1-6k-q-jmms50GUUxGg",
  authDomain: "a2moring.firebaseapp.com",
  databaseURL: "https://a2moring-default-rtdb.firebaseio.com",
  projectId: "a2moring",
  storageBucket: "a2moring.firebasestorage.app",
  messagingSenderId: "528466835850",
  appId: "1:528466835850:web:ee5cfc804c2bdaf71fb073",
  measurementId: "G-2HVR18MNEZ",
};
let pushHubApp = null;
let pushHubDb = null;

function getPushHubDb() {
  if (!window.firebase?.database) return null;
  if (pushHubDb) return pushHubDb;
  pushHubApp = firebase.apps.find(app => app.name === "push-hub")
    || firebase.initializeApp(PUSH_HUB_CONFIG, "push-hub");
  pushHubDb = firebase.database(pushHubApp);
  return pushHubDb;
}

async function fetchPushIdForPhone(phone) {
  const mobile = String(phone || "").replace(/\D/g, "");
  if (!/^\d{10,}$/.test(mobile)) return "";
  // Prefer the push hub All Users/{phone}/push
  try {
    const hub = getPushHubDb();
    if (hub) {
      const snap = await hub.ref(`All Users/${mobile}/push`).once("value");
      const val = snap.val();
      const id = typeof val === "string" ? val.trim() : (val && typeof val === "object" ? String(val.id || val.push || "").trim() : "");
      if (id) return id;
    }
  } catch (error) {
    console.warn("Push hub read failed", error);
  }
  // Fallback: main A2Morning DATA/{phone}/push
  try {
    if (databaseRootRef) {
      const snap = await databaseRootRef.child(`DATA/${mobile}/push`).once("value");
      const val = snap.val();
      const id = typeof val === "string" ? val.trim() : "";
      if (id) return id;
    }
  } catch (error) {
    console.warn("DATA push read failed", error);
  }
  return "";
}

async function onesignalBroadcast(title, message, data = {}) {
  return requestBroadcast("send", {
    heading: String(title || "A2Morning"),
    message: String(message || ""),
    data,
  });
}

async function onesignalToPlayerIds(playerIds, title, message, data = {}) {
  const ids = [...new Set((playerIds || []).map(id => String(id || "").trim()).filter(Boolean))];
  if (!ids.length) throw new Error("No push subscription id for this user.");
  const results = [];
  for (const subscriptionId of ids) {
    results.push(await requestBroadcast("send", {
      heading: String(title || "A2Morning"),
      message: String(message || ""),
      subscriptionId,
      data,
    }));
  }
  const result = {
    recipients: results.reduce((sum, result) => sum + (Number(result.recipients) || 0), 0),
    notificationIds: results.map(result => result.notificationId).filter(Boolean),
  };
  if (!result.recipients) throw new Error("OneSignal accepted no subscribed recipients. Check the app ID and player subscription.");
  return result;
}

async function notifyUserByPhone(phone, title, message, data = {}) {
  const pushId = await fetchPushIdForPhone(phone);
  if (!pushId) {
    console.warn("No push id for", phone);
    return { skipped: true, reason: "no_push_id" };
  }
  return onesignalToPlayerIds([pushId], title, message, data);
}

const ADMIN_SESSION_KEY = "srideviMatkaAdminSession";
const ADMIN_CREDENTIAL_FINGERPRINT_KEY = "srideviMatkaAdminCredentialFingerprint";
const DEFAULT_WITHDRAWAL_WINDOWS = {
  morning: { open: "09:30", close: "13:30" },
  evening: { open: "18:45", close: "21:00" },
};
const MARKET_WEEKDAYS = [
  { name: "Monday", bucket: "GAMES" },
  { name: "Tuesday", bucket: "GAMES" },
  { name: "Wednesday", bucket: "GAMES" },
  { name: "Thursday", bucket: "GAMES" },
  { name: "Friday", bucket: "GAMES" },
  { name: "Saturday", bucket: "GAMES2" },
  { name: "Sunday", bucket: "GAMES3" },
];
let adminExpertGuessing = {};
let adminExpertGuessingLoaded = false;
let adminExpertGuessingLoadInProgress = false;
let adminExpertGuessingSeedInProgress = false;
let withdrawalWindowsSeedStarted = false;
const generatedExpertGuessing = new Map();

const navigation = [
  { section: "OVERVIEW" },
  { id: "dashboard", label: "Dashboard", icon: "⌂" },
  { id: "new-users", label: "New users", icon: "✦" },
  { section: "OPERATIONS" },
  { id: "players", label: "Players", icon: "♙" },
  { id: "deposit-requests", label: "Deposit requests", icon: "＋", count: "deposit-pending" },
  { id: "withdrawal-requests", label: "Withdrawal requests", icon: "↗", count: "withdrawal-pending" },
  { id: "markets", label: "Markets & games", icon: "◈" },
  { id: "results", label: "Update results", icon: "✓" },
  { id: "winners", label: "Winners", icon: "★" },
  { id: "rates", label: "Rate chart", icon: "▤" },
  { section: "INSIGHTS & TOOLS" },
  { id: "transactions", label: "Transactions", icon: "↕" },
  { id: "played", label: "Bid history & played games", icon: "▦" },
  { id: "reports", label: "Reports", icon: "▥" },
  { id: "notices", label: "Notices", icon: "◉" },
  { id: "push-notify", label: "Push notifications", icon: "🔔" },
  { id: "settings", label: "Game settings", icon: "⚙" },
  { section: "PLAYER APP PREVIEW" },
  { id: "player-app", label: "Place a game", icon: "♟" },
  { id: "player-account", label: "Player account", icon: "▣" },
  { id: "player-history", label: "My game activity", icon: "▧" },
];

const icons = {
  players: "total_users.png",
  add: "payment-method.png",
  withdraw: "withdrawal.png",
  requests: "withdraw_request.png",
  results: "Update_result.png",
  winners: "Winners.png",
  markets: "admin.png",
  played: "played_games.png",
  reports: "old_records.png",
  transactions: "transactions.png",
  rates: "change_rates.png",
  notices: "notice.png",
  settings: "game_setting.png",
  blocked: "blocked_list.png",
};

const defaultData = {
  players: [],
  markets: [],
  requests: [],
  transactions: [],
  rates: [
    { id: "Single Digit", value: 95 },
    { id: "Jodi Digit", value: 9800 },
    { id: "Single Pana", value: 1450 },
    { id: "Double Pana", value: 2900 },
    { id: "Triple Pana", value: 6500 },
    { id: "Half Sangam", value: 10000 },
    { id: "Full Sangam", value: 100000 },
  ],
  bets: [],
  settlements: [],
  settings: {
    maintenance: false,
    newRegistrations: true,
    openBets: true,
    closeBets: true,
    signUpBonus: 0,
    minimumDeposit: 0,
    qrCodeEnabled: true,
    directPaymentEnabled: false,
    paymentGatewayEnabled: false,
    qrCode: "",
    upiId: "",
    upiUrlTemplate: "",
    paymentGatewayUrl: "",
    minimumWithdrawal: 0,
    minimumEntry: 0,
    maximumEntry: 0,
    withdrawTiming: "",
    withdrawalWindows: DEFAULT_WITHDRAWAL_WINDOWS,
    withdrawalWindowsConfigured: false,
    policy: "",
    websiteUrl: "",
    matka60Url: "",
    matka30Url: "",
    contactUrl: "",
    telegramUrl: "",
    resultChartUrl: "",
    noticeTitle: "Welcome to A2Morning",
    noticeMessage: "Good luck and play responsibly.",
  },
};

function createEmptyData() {
  const initial = structuredClone(defaultData);
  initial.updatedAt = new Date().toISOString();
  return initial;
}

function normalizeData(value) {
  const toArray = (collection) => {
    if (Array.isArray(collection)) return collection;
    if (!collection || typeof collection !== "object") return [];
    return Object.entries(collection).map(([id, item]) => (
      item && typeof item === "object" ? { id, ...item } : item
    ));
  };
  const normalized = { ...createEmptyData(), ...value };
  for (const key of ["players", "markets", "requests", "transactions", "rates", "bets", "settlements"]) {
    normalized[key] = toArray(normalized[key]);
  }
  normalized.settings = { ...createEmptyData().settings, ...(value.settings || {}) };
  return normalized;
}

function numberFromLegacy(value) {
  const parsed = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function legacyRequestAmount(value) {
  if (typeof value !== "string") return numberFromLegacy(value);
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return null;
  } catch (error) {
    return numberFromLegacy(value);
  }
  return numberFromLegacy(value);
}

function legacyDate(value) {
  const match = String(value || "").match(/^(\d{2})-(\d{2})-(\d{4})/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : String(value || "");
}

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function marketTypeFromName(name) {
  if (/starline/i.test(name)) return "Starline";
  if (/gali|disawar|delhi/i.test(name)) return "Gali / Disawar";
  return "Main market";
}

function marketTimeInput(value) {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (!match) return "";
  let hour = Number(match[1]);
  if (match[3]) {
    if (hour < 1 || hour > 12) return "";
    hour %= 12;
    if (match[3].toUpperCase() === "PM") hour += 12;
  }
  if (hour > 23 || Number(match[2]) > 59) return "";
  return `${String(hour).padStart(2, "0")}:${match[2]}`;
}

function legacyMarketTime(value) {
  const match = String(value || "").match(/^(\d{2}):(\d{2})$/);
  if (!match) return String(value || "");
  const hour = Number(match[1]);
  if (hour > 23 || Number(match[2]) > 59) return String(value);
  const meridiem = hour >= 12 ? "PM" : "AM";
  return `${String(hour % 12 || 12).padStart(2, "0")}:${match[2]}:00 ${meridiem}`;
}

function nextLegacyMarketKey(source) {
  const usedKeys = new Set([
    ...Array.from(legacyMarketKeys.get(source) || []),
    ...data.markets.flatMap((market) => {
      const entries = marketLegacyEntries(market);
      return entries[source] ? [String(entries[source])] : [];
    }),
  ]);
  let key = 1;
  while (usedKeys.has(String(key))) key += 1;
  return String(key);
}

function marketLegacyEntries(market) {
  if (market?.legacyEntries && typeof market.legacyEntries === "object") {
    return Object.fromEntries(Object.entries(market.legacyEntries)
      .filter(([source, key]) => ["GAMES", "GAMES2", "GAMES3"].includes(source) && key !== "" && key !== null)
      .map(([source, key]) => [source, String(key)]));
  }
  return market?.legacySource && market?.legacyKey
    ? { [market.legacySource]: String(market.legacyKey) }
    : {};
}

function marketDaysForSource(source) {
  return MARKET_WEEKDAYS.filter((day) => day.bucket === source).map((day) => day.name);
}

function normalizedMarketDays(value, fallback = []) {
  const values = Array.isArray(value) ? value : [];
  const selected = new Set(values.map((day) => String(day).trim().toLowerCase()));
  const days = MARKET_WEEKDAYS
    .map((day) => day.name)
    .filter((day) => selected.has(day.toLowerCase()));
  return days.length ? days : fallback.slice();
}

function marketDaysLabel(days) {
  const selected = new Set(normalizedMarketDays(days));
  if (selected.size === 7) return "Every day";
  if (["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].every((day) => selected.has(day))) return "Mon–Sat";
  if (["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].every((day) => selected.has(day))) return "Mon–Fri";
  if (selected.size === 2 && selected.has("Friday") && selected.has("Saturday")) return "Fri–Sat";
  return MARKET_WEEKDAYS.filter((day) => selected.has(day.name)).map((day) => day.name.slice(0, 3)).join(", ") || "No days selected";
}

function decodeLegacyValue(value) {
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

function normalizeWithdrawalWindows(value) {
  const decoded = decodeLegacyValue(value);
  if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) return DEFAULT_WITHDRAWAL_WINDOWS;
  const window = (period, openKey, closeKey) => {
    const entry = decodeLegacyValue(decoded[period]);
    const fields = entry && typeof entry === "object" && !Array.isArray(entry) ? entry : {};
    return {
      open: String(decodeLegacyValue(fields.open ?? decoded[openKey]) || ""),
      close: String(decodeLegacyValue(fields.close ?? decoded[closeKey]) || ""),
    };
  };
  const result = {
    morning: window("morning", "morningOpen", "morningClose"),
    evening: window("evening", "eveningOpen", "eveningClose"),
  };
  const validTime = value => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
  return Object.values(result).every(item => validTime(item.open) && validTime(item.close))
    ? result : DEFAULT_WITHDRAWAL_WINDOWS;
}

function normalizeExpertGuessing(value) {
  const decoded = decodeLegacyValue(value);
  if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) return {};
  return Object.fromEntries(Object.entries(decoded).map(([key, rawGuess]) => {
    const guess = decodeLegacyValue(rawGuess);
    if (!guess || typeof guess !== "object" || Array.isArray(guess)) return [key, {}];
    return [key, {
      marketName: String(guess.marketName || key),
      ank: guess.ANK ?? guess.ank ?? [],
      jodi: guess.JODI ?? guess.jodi ?? [],
      panna: guess.PANNA ?? guess.panna ?? [],
    }];
  }));
}

function adminGuessingMarketKey(name) {
  return String(name || "").trim().replace(/[.#$\[\]/]/g, "_");
}

function adminGuessingMarket(marketName) {
  const normalizedName = String(marketName || "").trim().toLocaleLowerCase();
  const entry = Object.entries(adminExpertGuessing).find(([key, guess]) =>
    String(guess.marketName || key).trim().toLocaleLowerCase() === normalizedName
  );
  return entry ? entry[1] : null;
}

function displayGuessNumbers(value) {
  if (Array.isArray(value)) return value.map(item => String(item ?? "").trim()).filter(Boolean).join(" - ");
  if (value && typeof value === "object" && Object.keys(value).every(key => /^\d+$/.test(key))) {
    return Object.entries(value).sort(([left], [right]) => Number(left) - Number(right))
      .map(([, item]) => String(item ?? "").trim()).filter(Boolean).join(" - ");
  }
  return String(value || "").trim();
}

function randomGuessNumbers(count, digits) {
  const values = [];
  const cryptoSource = globalThis.crypto;
  for (let index = 0; index < count; index += 1) {
    const buffer = new Uint32Array(1);
    if (cryptoSource?.getRandomValues) cryptoSource.getRandomValues(buffer);
    else buffer[0] = Math.floor(Math.random() * 0xFFFFFFFF);
    const max = 10 ** digits;
    values.push(String(buffer[0] % max).padStart(digits, "0"));
  }
  return values;
}

function defaultAdminGuess(marketName) {
  const key = String(marketName || "").trim().toLocaleLowerCase();
  if (!generatedExpertGuessing.has(key)) {
    const values = {
      ank: randomGuessNumbers(4, 1),
      jodi: randomGuessNumbers(8, 2),
      panna: randomGuessNumbers(6, 3),
    };
    generatedExpertGuessing.set(key, values);
  }
  return generatedExpertGuessing.get(key);
}

async function fetchAdminExpertGuessing() {
  const snapshot = await expertGuessingDatabaseRef().once("value");
  adminExpertGuessing = normalizeExpertGuessing(snapshot.val());
}

function expertGuessingDatabaseRef() {
  const app = firebase.apps.find(item => item.name === "sridevi-matka-expert-guessing")
    || firebase.initializeApp(expertGuessingFirebaseConfig, "sridevi-matka-expert-guessing");
  return firebase.database(app).ref("ExpertGuessing");
}

function uniqueGuessingMarkets() {
  return [...new Map([...data.markets]
    .sort((left, right) => Number(left.position) - Number(right.position) || left.name.localeCompare(right.name))
    .map(market => [market.name.trim().toLocaleLowerCase(), market])).values()];
}

function parseGuessNumbers(value, digits, label, marketName) {
  const text = String(value || "").trim();
  if (!text) return [];
  const numbers = text.split(/[\s,-]+/).filter(Boolean);
  if (!numbers.length || numbers.some(number => !new RegExp(`^\\d{1,${digits}}$`).test(number))) {
    throw new Error(`${label} for ${marketName} must be separated by spaces, commas, or hyphens and contain at most ${digits} digits per number.`);
  }
  return numbers.map(number => digits === 1 ? Number(number) : number.padStart(digits, "0"));
}

async function saveAdminExpertGuessing(form) {
  const markets = uniqueGuessingMarkets();
  if (!markets.length) throw new Error("Add at least one market before saving expert numbers.");
  const patch = {};
  for (const [index, market] of markets.entries()) {
    const key = adminGuessingMarketKey(market.name);
    const ank = parseGuessNumbers(form.get(`guess-${index}-ank`), 1, "ANK", market.name);
    const jodi = parseGuessNumbers(form.get(`guess-${index}-jodi`), 2, "JODI", market.name);
    const panna = parseGuessNumbers(form.get(`guess-${index}-panna`), 3, "PANNA", market.name);
    patch[key] = ank.length || jodi.length || panna.length
      ? { marketName: market.name, ANK: ank, JODI: jodi, PANNA: panna }
      : null;
  }
  try {
    await expertGuessingDatabaseRef().update(patch);
  } catch (error) {
    throw new Error(`Expert numbers were not saved to web-result Firebase: ${error.message}`);
  }
  await fetchAdminExpertGuessing();
  for (const market of markets) {
    const entry = adminGuessingMarket(market.name);
    if (!entry && patch[adminGuessingMarketKey(market.name)] !== null) {
      throw new Error(`Firebase did not return saved expert numbers for ${market.name}.`);
    }
  }
}

async function seedMissingAdminExpertGuessing() {
  if (adminExpertGuessingSeedInProgress) return;
  const markets = uniqueGuessingMarkets();
  if (!markets.length) return;
  const missing = markets.filter(market => !adminGuessingMarket(market.name));
  if (!missing.length) return;
  adminExpertGuessingSeedInProgress = true;
  try {
    const patch = {};
    for (const market of missing) {
      const guess = defaultAdminGuess(market.name);
      patch[adminGuessingMarketKey(market.name)] = {
        marketName: market.name,
        ANK: guess.ank,
        JODI: guess.jodi,
        PANNA: guess.panna,
      };
    }
    try {
      await expertGuessingDatabaseRef().update(patch);
    } catch (error) {
      throw new Error(`Could not create expert numbers for all markets in web-result Firebase: ${error.message}`);
    }
    await fetchAdminExpertGuessing();
    if (missing.some(market => !adminGuessingMarket(market.name))) {
      throw new Error("Some market expert numbers could not be confirmed after saving.");
    }
    if (currentPage === "settings") render();
    toast(`Created editable expert number sets for ${missing.length} market${missing.length === 1 ? "" : "s"}.`);
  } finally {
    adminExpertGuessingSeedInProgress = false;
  }
}

function ensureDefaultWithdrawalWindows(root) {
  if (withdrawalWindowsSeedStarted) return;
  const configured = root.Admin?.Admin?.WRTiming;
  if (configured !== undefined && configured !== null) {
    withdrawalWindowsSeedStarted = true;
    return;
  }
  withdrawalWindowsSeedStarted = true;
  databaseRootRef.child("Admin/Admin/WRTiming").transaction(current =>
    current === null ? DEFAULT_WITHDRAWAL_WINDOWS : undefined
  ).then(result => {
    if (result.committed) toast("Default withdrawal hours saved at Admin/Admin/WRTiming.");
  }).catch(error => {
    withdrawalWindowsSeedStarted = false;
    toast(`Default withdrawal hours could not be saved: ${error.message}`, true);
  });
}

function isTruthySetting(value) {
  const decoded = decodeLegacyValue(value);
  return decoded === true || decoded === 1 || /^(true|1|yes|on|blocked)$/i.test(String(decoded ?? "").trim());
}

function parseLegacyBidHistoryTag(value) {
  const match = String(value || "").match(/^(\d{2}-\d{2}-\d{4})\s+(\d{1,2}:\d{2}:\d{2}(?:\s+[AP]M)?):([^:]+):"([^"]*)"$/i);
  if (!match) return null;
  const amount = Number(match[3]);
  return {
    date: match[1],
    time: match[2],
    amount: Number.isFinite(amount) ? amount : undefined,
    selection: match[4],
  };
}

function legacyBidTimestamp(date, time) {
  const dateMatch = String(date).match(/^(\d{2})-(\d{2})-(\d{4})$/);
  const timeMatch = String(time).match(/^(\d{1,2}):(\d{2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!dateMatch || !timeMatch) return "";
  let hour = Number(timeMatch[1]);
  if (timeMatch[4]) {
    if (hour < 1 || hour > 12) return "";
    hour %= 12;
    if (timeMatch[4].toUpperCase() === "PM") hour += 12;
  }
  const timestamp = new Date(
    Number(dateMatch[3]), Number(dateMatch[2]) - 1, Number(dateMatch[1]),
    hour, Number(timeMatch[2]), Number(timeMatch[3]),
  );
  return Number.isNaN(timestamp.getTime()) ? "" : timestamp.toISOString();
}

function legacyPaymentRequest(value, kind) {
  const decoded = decodeLegacyValue(value);
  if (!Array.isArray(decoded)) {
    const amount = legacyRequestAmount(decoded);
    return { amount, amountUnavailable: amount === null, method: "Legacy record", details: "", balanceDeducted: false, status: "Pending" };
  }
  const rawStatus = String(decoded.at(-1) || "").trim();
  const status = ["Approved", "Refunded", "Rejected", "Deleted", "Failed", "Cancelled"].find(item => item.toLowerCase() === rawStatus.toLowerCase()) || "Pending";

  if (kind === "Deposit") {
    const amount = Number(decoded[3]);
    const reference = String(decoded[2] || "").trim();
    const balance = Number(decoded[4]);
    return {
      amount,
      amountUnavailable: !Number.isFinite(amount),
      method: String(decoded[1] || "Deposit"),
      details: [
        reference && `Reference: ${reference}`,
        decoded[4] !== undefined && decoded[4] !== "" && Number.isFinite(balance) && `Balance at request: ${money(balance)}`,
        String(decoded[5] || "").startsWith("UPI app reported") && String(decoded[5]),
      ].filter(Boolean).join(" · "),
      balanceDeducted: false,
      status,
    };
  }

  const amount = Number(decoded[7]);
  const details = [
    decoded[1] && `Account holder: ${decoded[1]}`,
    decoded[2] && `Account: ${decoded[2]}`,
    decoded[4] && `IFSC: ${decoded[4]}`,
    decoded[5] && `PhonePe: ${decoded[5]}`,
    decoded[6] && `Google Pay: ${decoded[6]}`,
    decoded[8] !== undefined && decoded[8] !== "" && Number.isFinite(Number(decoded[8]))
      && `Left balance: ${money(Number(decoded[8]))}`,
  ].filter(Boolean).join(" · ");
  return {
    amount,
    amountUnavailable: !Number.isFinite(amount),
    method: details ? "Withdrawal details" : "Withdrawal",
    details,
    balanceDeducted: true,
    status,
  };
}

function normalizeLegacyData(root) {
  const legacy = createEmptyData();
  const blocked = root.Blocked && typeof root.Blocked === "object" ? root.Blocked : {};
  const sourcePlayers = root.DATA && typeof root.DATA === "object" ? root.DATA : {};

  legacy.players = Object.entries(sourcePlayers)
    .filter(([mobile, player]) => /^\d{10,}$/.test(mobile) && player && typeof player === "object")
    .map(([mobile, player]) => ({
      id: mobile,
      name: String(decodeLegacyValue(player.name) || mobile),
      mobile,
      balance: numberFromLegacy(player.bal ?? player.COINS ?? player.B2),
      played: 0,
      totalAdded: numberFromLegacy(player.TD),
      totalWithdrawn: numberFromLegacy(player.TW),
      balanceField: Object.prototype.hasOwnProperty.call(player, "bal") ? "bal"
        : Object.prototype.hasOwnProperty.call(player, "COINS") ? "COINS"
          : Object.prototype.hasOwnProperty.call(player, "B2") ? "B2" : "",
      status: isTruthySetting(player.blocked) || isTruthySetting(blocked[mobile]) ? "Blocked" : "Active",
      approved: true,
      joined: "",
    }));

  const marketMap = new Map();
  for (const source of ["GAMES", "GAMES2", "GAMES3"]) {
    const games = root[source];
    if (!games || typeof games !== "object") continue;
    for (const [id, value] of Object.entries(games)) {
      if (id === "x" || value === null || value === undefined || String(value).trim() === "") continue;
      let fields = [];
      if (typeof value === "string" && value.trim().startsWith("[")) {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) fields = parsed;
        } catch (error) {
          console.warn(`Could not parse legacy market ${source}/${id}:`, error);
        }
      }
      const name = String(fields[0] || value).trim();
      const statusValue = String(fields[5] || "");
      let marketMetadata = {};
      if (typeof fields[8] === "string") {
        try {
          const parsed = JSON.parse(fields[8]);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) marketMetadata = parsed;
        } catch (error) {
          console.warn(`Could not parse day schedule for legacy market ${source}/${id}:`, error);
        }
      } else if (fields[8] && typeof fields[8] === "object" && !Array.isArray(fields[8])) {
        marketMetadata = fields[8];
      }
      const marketIdentity = String(marketMetadata.id || `${source}-${id}`);
      const defaultDays = marketDaysForSource(source);
      const days = normalizedMarketDays(marketMetadata.days, defaultDays);
      const entry = {
        id: marketIdentity,
        name,
        type: marketTypeFromName(name),
        open: String(fields[1] || ""),
        close: String(fields[2] || ""),
        status: /close|stop|off/i.test(statusValue) ? "Closed" : "Open",
        result: "—",
        resultDate: String(marketMetadata.resultDate || ""),
        position: numberFromLegacy(fields[7] || id),
        days,
        legacyEntries: { [source]: id },
        legacySource: source,
        legacyKey: id,
        legacyFields: fields,
      };
      if (!marketMap.has(marketIdentity)) {
        marketMap.set(marketIdentity, entry);
      } else {
        const existing = marketMap.get(marketIdentity);
        existing.legacyEntries[source] = id;
        existing.days = normalizedMarketDays([...existing.days, ...days]);
      }
    }
  }
  legacy.markets = Array.from(marketMap.values());
  const resultGroups = root.Players && typeof root.Players === "object" ? root.Players : {};
  for (const [date, markets] of Object.entries(resultGroups)) {
    if (date === "x" || !markets || typeof markets !== "object") continue;
    for (const [name, sessions] of Object.entries(markets)) {
      if (!sessions || typeof sessions !== "object") continue;
      const matchingMarkets = legacy.markets.filter((market) => market.name.toLowerCase() === name.trim().toLowerCase());
      for (const [session, values] of Object.entries(sessions)) {
        if (!/^(open|close)$/i.test(session)) continue;
        const collectResults = (node) => {
          if (typeof node === "string") return node.trim() && node.trim().toLowerCase() !== "x" ? [node.trim()] : [];
          if (!node || typeof node !== "object") return [];
          return Object.values(node).flatMap(collectResults);
        };
        const result = collectResults(values).at(-1);
        if (!result) continue;
        for (const market of matchingMarkets) {
          const normalizedDate = legacyDate(date);
          market.results = market.results || [];
          market.results.push({ session, date: normalizedDate, result });
          if (!market.updatedAt || normalizedDate >= market.updatedAt) {
            market.result = result;
            market.updatedAt = normalizedDate;
          }
          market[session.toLowerCase() + "Result"] = result;
        }
      }
    }
  }
  const resultCharts = root.Results && typeof root.Results === "object" ? root.Results : {};
  for (const [name, datedResults] of Object.entries(resultCharts)) {
    if (!datedResults || typeof datedResults !== "object") continue;
    const matchingMarkets = legacy.markets.filter((market) => market.name.trim().toLowerCase() === name.trim().toLowerCase());
    for (const [date, value] of Object.entries(datedResults)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || typeof value !== "string" || !value.trim() || value.trim().toLowerCase() === "x") continue;
      for (const market of matchingMarkets) {
        market.results = market.results || [];
        if (!market.results.some((item) => item.date === date)) {
          market.results.push({ session: "", date, result: value.trim() });
        }
        if (!market.updatedAt || date >= market.updatedAt) {
          market.result = value.trim();
          market.updatedAt = date;
        }
      }
    }
  }

  const rates = root["Rate Chart"];
  if (rates && typeof rates === "object") {
    const rateNames = ["Single Digit", "Jodi Digit", "Single Pana", "Double Pana", "Triple Pana", "Half Sangam", "Full Sangam"];
    legacy.rates = Object.entries(rates)
      .filter(([id]) => id !== "x")
      .sort(([a], [b]) => numberFromLegacy(a) - numberFromLegacy(b))
      .map(([id, value], index) => ({ id: rateNames[numberFromLegacy(id) - 1] || rateNames[index] || `Rate ${id}`, value: numberFromLegacy(value) }));
  }

  for (const [source, kind] of [["WR", "Withdrawal"], ["DR", "Deposit"]]) {
    const requests = root[source];
    if (!requests || typeof requests !== "object") continue;
    for (const [id, value] of Object.entries(requests)) {
      if (id === "x" || value === null || value === undefined) continue;
      const mobile = id.match(/\d{10,}$/)?.[0] || "";
      const player = legacy.players.find((item) => item.mobile === mobile);
      const request = legacyPaymentRequest(value, kind);
      legacy.requests.push({
        id: `${source}-${id}`,
        player: player?.name || mobile || "Legacy request",
        mobile,
        kind,
        ...request,
        legacyValue: decodeLegacyValue(value),
        amount: Number.isFinite(request.amount) ? request.amount : 0,
        created: id.replace(/\s+\d{10,}$/, ""),
        status: request.status,
      });
    }
  }

  const bidRecordRoot = root["Normal T Data"];
  const transactionRoot = root["Normal T Data2"];
  if (transactionRoot && typeof transactionRoot === "object") {
    for (const [mobile, records] of Object.entries(transactionRoot)) {
      if (!/^\d{10,}$/.test(mobile) || !records || typeof records !== "object") continue;
      const player = legacy.players.find((item) => item.mobile === mobile);
      const addBid = (date, historyKey, parsed, historyValue) => {
        const bidRecords = bidRecordRoot?.[mobile]?.[date];
        const matchingDetails = [];
        if (bidRecords && typeof bidRecords === "object") {
          for (const [tag, rawDetail] of Object.entries(bidRecords)) {
            const parts = tag.split("&");
            if (parts.length < 4 || parts[1] !== parsed.time || parts[2] !== parsed.selection) continue;
            const candidate = {
              tag,
              market: parts[parts.length - 1].split(" : ")[0],
              payload: decodeLegacyValue(rawDetail),
            };
            matchingDetails.push(candidate);
          }
        }
        const amountMatches = matchingDetails.filter((candidate) => Array.isArray(candidate.payload)
          && Number(candidate.payload[3]) === parsed.amount);
        const detail = amountMatches.length === 1 ? amountMatches[0]
          : matchingDetails.length === 1
            && (!Array.isArray(matchingDetails[0].payload)
              || !Number.isFinite(Number(matchingDetails[0].payload[3]))
              || Number(matchingDetails[0].payload[3]) === parsed.amount)
            ? matchingDetails[0] : undefined;
        const payload = Array.isArray(detail?.payload) ? detail.payload : [];
        const amountFromPayload = Number(payload[3]);
        const amount = parsed.amount ?? (Number.isFinite(amountFromPayload) ? amountFromPayload : 0);
        const gameType = String(payload[0] || "Bid");
        const session = String(payload[1] || "");
        const selection = parsed.selection || String(payload[2] || "");
        const market = detail?.market || "Bid";
        const time = String(payload[4] || parsed.time);
        const dateTime = `${legacyDate(parsed.date)} ${time}`;
        const id = `legacy-bid-${mobile}-${date}-${historyKey}`;
        legacy.bets.push({
          id,
          playerId: mobile,
          player: player?.name || mobile,
          mobile,
          market,
          session,
          type: gameType,
          number: selection,
          points: amount,
          date: dateTime,
          createdAt: legacyBidTimestamp(parsed.date, time),
          legacyHistoryPath: `Normal T Data2/${mobile}/${date}/${historyKey}`,
          legacyHistoryValue: String(decodeLegacyValue(historyValue)),
          legacyDetailPath: detail ? `Normal T Data/${mobile}/${date}/${detail.tag}` : "",
          legacyDetailTag: detail?.tag || "",
          legacyDetailValue: payload.length ? payload : null,
        });
        legacy.transactions.push({
          id,
          player: player?.name || mobile,
          mobile,
          type: "Played",
          amount: -amount,
          date: dateTime,
          note: `${market} · ${session} · ${gameType} ${selection}`,
        });
      };
      const visit = (node, path, currentDate = "", recordKey = "") => {
        if (typeof node === "string" && node !== "x") {
          const parsed = parseLegacyBidHistoryTag(decodeLegacyValue(node))
            || parseLegacyBidHistoryTag(recordKey);
          if (parsed) {
            addBid(currentDate || parsed.date, recordKey, parsed, node);
            return;
          }
          const dateMatch = node.match(/\d{2}-\d{2}-\d{4}/);
          legacy.transactions.push({
            id: `legacy-${mobile}-${path}`,
            player: player?.name || mobile,
            mobile,
            type: "Legacy activity",
            amount: 0,
            amountUnavailable: true,
            date: legacyDate(dateMatch?.[0]),
            note: node,
          });
          return;
        }
        if (!node || typeof node !== "object") return;
        if (Object.prototype.hasOwnProperty.call(node, "amount")) {
          const amount = numberFromLegacy(node.amount);
          const category = String(node.category || node.gameType || "Transaction");
          const date = String(node.createdAt || "");
          const market = String(node.market || "");
          const selection = String(node.selection || "");
          const note = [node.title, market, selection].filter(Boolean).join(" · ");
          const id = `legacy-${mobile}-${path}`;
          legacy.transactions.push({
            id,
            player: player?.name || mobile,
            mobile,
            type: category === "Deposit" ? "Added" : category === "Withdrawal" ? "Withdrawal" : category,
            amount: category === "Withdrawal" ? -Math.abs(amount) : amount,
            date: legacyDate(date),
            note,
          });
          if (node.gameType) {
            legacy.bets.push({
              id,
              playerId: mobile,
              player: player?.name || mobile,
              market,
              session: String(node.session || ""),
              type: String(node.gameType),
              number: selection,
              points: amount,
              date,
            });
          }
          return;
        }
        for (const [key, child] of Object.entries(node)) {
          if (key !== "x") {
            const date = /^\d{2}-\d{2}-\d{4}$/.test(key) ? key : currentDate;
            visit(child, `${path}-${key}`, date, key);
          }
        }
      };
      visit(records, "record");
    }
  }

  const playedByMobile = new Map();
  for (const bet of legacy.bets) {
    const mobile = String(bet.mobile || bet.playerId || "");
    if (/^\d{10,}$/.test(mobile)) {
      playedByMobile.set(mobile, (playedByMobile.get(mobile) || 0) + (Number(bet.points) || 0));
    }
  }
  for (const player of legacy.players) {
    player.played = playedByMobile.get(player.mobile) || 0;
    const walletRecords = sourcePlayers[player.mobile]?.transactions;
    if (walletRecords && typeof walletRecords === "object" && !Array.isArray(walletRecords)) {
      for (const [key, rawRecord] of Object.entries(walletRecords)) {
        const record = decodeLegacyValue(rawRecord);
        if (!record || typeof record !== "object" || Array.isArray(record)) continue;
        const transaction = {
          id: String(record.id || key),
          player: player.name,
          mobile: player.mobile,
          type: String(record.type || "Wallet"),
          amount: numberFromLegacy(record.amount),
          date: String(record.date || record.createdAt || ""),
          note: String(record.note || record.title || record.type || "Wallet activity"),
        };
        legacy.transactions.push(transaction);
      }
    }
    const demoWallet = decodeLegacyValue(sourcePlayers[player.mobile]?.demoWallet);
    const demoTransactions = demoWallet && typeof demoWallet === "object" && !Array.isArray(demoWallet)
      ? demoWallet.transactions : null;
    if (demoTransactions && typeof demoTransactions === "object" && !Array.isArray(demoTransactions)) {
      for (const [key, rawRecord] of Object.entries(demoTransactions)) {
        const record = decodeLegacyValue(rawRecord);
        if (!record || typeof record !== "object" || Array.isArray(record)) continue;
        legacy.transactions.push({
          id: String(record.orderId || record.id || key),
          player: player.name,
          mobile: player.mobile,
          type: "Demo test",
          amount: numberFromLegacy(record.amount),
          date: String(record.date || record.createdAt || ""),
          note: `DEMO ONLY — ${String(record.note || "UPI app test; not a verified payment.")}`,
          demo: true,
        });
      }
    }
  }

  const notice = root.Notice && typeof root.Notice === "object" ? decodeLegacyValue(root.Notice.Notice) : "";
  if (typeof notice === "string" && notice) legacy.settings.noticeMessage = notice;
  const adminSettings = decodeLegacyValue(decodeLegacyValue(root.Admin)?.Admin);
  if (adminSettings && typeof adminSettings === "object") {
    legacy.settings.maintenance = /^(true|1|yes|on)$/i.test(String(adminSettings.Maintanance || ""));
    legacy.settings.newRegistrations = adminSettings.EnableNewRegistrations === undefined
      ? true : /^(true|1|yes|on)$/i.test(String(adminSettings.EnableNewRegistrations));
    legacy.settings.openBets = adminSettings.EnableOpenBets === undefined
      ? true : /^(true|1|yes|on)$/i.test(String(adminSettings.EnableOpenBets));
    legacy.settings.closeBets = adminSettings.EnableCloseBets === undefined
      ? true : /^(true|1|yes|on)$/i.test(String(adminSettings.EnableCloseBets));
    legacy.settings.signUpBonus = numberFromLegacy(adminSettings["Sign Up Bonus"] ?? adminSettings.bonus ?? adminSettings.Bonus);
    legacy.settings.minimumDeposit = numberFromLegacy(adminSettings.MD);
    legacy.settings.qrCodeEnabled = adminSettings.QrCodeEnabled === undefined
      ? true : /^(true|1|yes|on)$/i.test(String(adminSettings.QrCodeEnabled));
    legacy.settings.directPaymentEnabled = adminSettings.DirectPaymentEnabled === undefined
      ? false : /^(true|1|yes|on)$/i.test(String(adminSettings.DirectPaymentEnabled));
    legacy.settings.paymentGatewayEnabled = adminSettings.PaymentGatewayEnabled === undefined
      ? Boolean(adminSettings.payment_api_url)
      : /^(true|1|yes|on)$/i.test(String(adminSettings.PaymentGatewayEnabled));
    legacy.settings.qrCode = String(decodeLegacyValue(adminSettings["Qr Code"] ?? adminSettings.qr_code) || "");
    legacy.settings.upiId = String(decodeLegacyValue(adminSettings.upi_id) || "");
    legacy.settings.upiUrlTemplate = String(decodeLegacyValue(adminSettings["Admin Upi"] ?? adminSettings.admin_upi) || "");
    legacy.settings.paymentGatewayUrl = String(decodeLegacyValue(adminSettings.payment_api_url) || "");
    legacy.settings.minimumWithdrawal = numberFromLegacy(adminSettings.MW);
    legacy.settings.minimumEntry = numberFromLegacy(adminSettings["Min Entry"]);
    legacy.settings.maximumEntry = numberFromLegacy(adminSettings["Max Entry"]);
    legacy.settings.withdrawTiming = String(decodeLegacyValue(adminSettings["Withdraw Timing"]) || "");
    legacy.settings.withdrawalWindows = normalizeWithdrawalWindows(adminSettings.WRTiming);
    legacy.settings.withdrawalWindowsConfigured = adminSettings.WRTiming !== undefined && adminSettings.WRTiming !== null;
    const policy = decodeLegacyValue(adminSettings.Policy);
    legacy.settings.policy = Array.isArray(policy) ? policy.join("\n\n") : String(policy || "");
    legacy.settings.websiteUrl = String(decodeLegacyValue(adminSettings.Website) || "");
    legacy.settings.matka60Url = String(decodeLegacyValue(adminSettings.matka60url) || "");
    legacy.settings.matka30Url = String(decodeLegacyValue(adminSettings.matka30url) || "");
    legacy.settings.contactUrl = String(decodeLegacyValue(adminSettings.Contact) || "");
    legacy.settings.telegramUrl = String(decodeLegacyValue(adminSettings.Telegram ?? adminSettings.TG) || "");
    legacy.settings.resultChartUrl = String(decodeLegacyValue(adminSettings["Market_Reult_chart_Web"]) || "");
  }
  return legacy;
}

function todayNewUsersDateKey(date = new Date()) {
  return `${String(date.getDate()).padStart(2, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${date.getFullYear()}`;
}

function readTodayNewUsers(root) {
  const usersByDate = root["New Users"];
  if (!usersByDate || typeof usersByDate !== "object" || Array.isArray(usersByDate)) return [];
  const todayUsers = usersByDate[todayNewUsersDateKey()];
  if (!todayUsers || typeof todayUsers !== "object" || Array.isArray(todayUsers)) return [];
  return Object.entries(todayUsers)
    .filter(([tag, value]) => tag !== "x" && value !== null && value !== undefined)
    .map(([tag, value]) => ({ tag, value }))
    .sort((left, right) => left.tag.localeCompare(right.tag, undefined, { numeric: true }));
}

function readLastSeenByMobile(root) {
  const lastSeen = new Map();
  const update = (mobile, value) => {
    if (!/^\d{10,}$/.test(String(mobile || "")) || value === null || value === undefined || value === "") return;
    lastSeen.set(mobile, { value: String(value), exact: true });
  };
  const profileRoot = root.DATA && typeof root.DATA === "object" ? root.DATA : {};
  for (const [mobile, profile] of Object.entries(profileRoot)) {
    if (!profile || typeof profile !== "object") continue;
    if (profile["Last Seen"] !== undefined) update(mobile, decodeLegacyValue(profile["Last Seen"]));
  }
  return lastSeen;
}

function lastSeenLabel(mobile) {
  const record = lastSeenByMobile.get(String(mobile || ""));
  if (!record) return "Never";
  const value = record.value;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const epoch = /^\d{10,13}$/.test(value) ? Number(value) * (value.length === 10 ? 1000 : 1) : null;
  const date = new Date(epoch ?? (dateOnly ? `${value}T12:00:00` : value));
  if (Number.isNaN(date.getTime())) return value;
  const options = record.exact && !dateOnly
    ? { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }
    : { day: "2-digit", month: "short", year: "numeric" };
  return date.toLocaleString("en-IN", options);
}

function lastSeenTimestamp(mobile) {
  const value = lastSeenByMobile.get(String(mobile || ""))?.value;
  if (!value) return null;
  if (/^\d{10,13}$/.test(value)) return Number(value) * (value.length === 10 ? 1000 : 1);
  const timestamp = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function readGameAccessByMobile(root) {
  const players = root.DATA;
  if (!players || typeof players !== "object" || Array.isArray(players)) return new Set();
  return new Set(Object.entries(players)
    .filter(([mobile, player]) => /^\d{10,}$/.test(mobile)
      && player && typeof player === "object"
      && Object.prototype.hasOwnProperty.call(player, "bal")
      && player.bal !== null
      && player.bal !== undefined)
    .map(([mobile]) => mobile));
}

function whatsappLink(mobile) {
  const digits = String(mobile || "").replace(/\D/g, "");
  if (digits.length < 10) return "";
  const whatsappNumber = digits.length === 10 ? `91${digits}` : digits;
  return `<a class="button small whatsapp-button" href="https://wa.me/${whatsappNumber}" target="_blank" rel="noopener noreferrer" aria-label="Message ${escapeHtml(mobile)} on WhatsApp">WhatsApp</a>`;
}

function gameAccessLabel(mobile) {
  const hasAccess = gameAccessByMobile.has(String(mobile || ""));
  return `<span class="status game-access ${hasAccess ? "game-access-enabled" : "game-access-disabled"}">${hasAccess ? "Game access" : "No game access"}</span>`;
}

function watchWebPlayAccess(mobile) {
  const phone = String(mobile || "").replace(/\D/g, "");
  if (!/^\d{10,}$/.test(phone) || webPlayAccessListeners.has(phone)) return;
  const db = getPushHubDb();
  if (!db) {
    webPlayAccessByMobile.set(phone, "error");
    return;
  }

  const ref = db.ref(`DATA/${phone}/WV`);
  webPlayAccessByMobile.set(phone, null);
  webPlayAccessListeners.set(phone, ref);
  try {
    ref.on("value", (snapshot) => {
      webPlayAccessByMobile.set(phone, isTruthySetting(snapshot.val()));
      if (currentPage === "players" || currentPage === "new-users") render(true);
    }, (error) => {
      webPlayAccessByMobile.set(phone, "error");
      toast(`Could not read WebPlay access for ${phone}: ${error.message}`, true);
      if (currentPage === "players" || currentPage === "new-users") render(true);
    });
  } catch (error) {
    webPlayAccessByMobile.set(phone, "error");
    webPlayAccessListeners.delete(phone);
    toast(`Could not monitor WebPlay access for ${phone}: ${error.message}`, true);
  }
}

function webPlayAccessControl(mobile) {
  const phone = String(mobile || "").replace(/\D/g, "");
  if (!/^\d{10,}$/.test(phone)) {
    return `<span class="status webplay-access-unavailable">No phone</span>`;
  }
  watchWebPlayAccess(phone);
  const status = webPlayAccessByMobile.get(phone);
  if (status === "error") return `<span class="status webplay-access-unavailable">Unavailable</span>`;
  if (status === null || status === undefined) {
    return `<span class="status pending">Checking</span>`;
  }
  const enabled = status === true;
  const pending = webPlayAccessPending.has(phone);
  return `<div class="webplay-access-cell"><span class="status ${enabled ? "webplay-access-approved" : "webplay-access-disapproved"}">${enabled ? "Approved" : "Disapproved"}</span><button class="button small ${enabled ? "danger" : "success"}" data-action="set-player-webplay" data-mobile="${escapeHtml(phone)}" data-enabled="${enabled ? "false" : "true"}" ${pending ? "disabled" : ""}>${pending ? "Saving…" : enabled ? "Disapprove" : "Approve"}</button></div>`;
}

function watchGlobalWebPlayAccess() {
  if (globalWebPlayAccessRef) globalWebPlayAccessRef.off();
  globalWebPlayAccessEnabled = null;
  globalWebPlayAccessError = "";
  const db = getPushHubDb();
  if (!db) throw new Error("The a2moring Firebase database is unavailable.");
  globalWebPlayAccessRef = db.ref("Admin/WV2");
  globalWebPlayAccessRef.on("value", (snapshot) => {
    globalWebPlayAccessEnabled = isTruthySetting(snapshot.val());
    globalWebPlayAccessError = "";
    if (currentPage === "settings") render(true);
  }, (error) => {
    globalWebPlayAccessEnabled = null;
    globalWebPlayAccessError = error.message || "Firebase read was denied.";
    toast(`Could not read global WebPlay access: ${globalWebPlayAccessError}`, true);
    if (currentPage === "settings") render(true);
  });
}

async function setPlayerWebPlayAccess(mobile, enabled) {
  const phone = String(mobile || "").replace(/\D/g, "");
  if (!/^\d{10,}$/.test(phone) || webPlayAccessPending.has(phone)) return;
  webPlayAccessPending.add(phone);
  render(true);
  try {
    const db = getPushHubDb();
    if (!db) throw new Error("The a2moring Firebase database is unavailable.");
    await db.ref(`DATA/${phone}/WV`).set(enabled);
    webPlayAccessByMobile.set(phone, enabled);
    toast(`WebPlay ${enabled ? "approved" : "disapproved"} for ${phone}.`);
  } catch (error) {
    toast(`Could not update WebPlay access for ${phone}: ${error.message}`, true);
  } finally {
    webPlayAccessPending.delete(phone);
    render(true);
  }
}

async function setGlobalWebPlayAccess(enabled) {
  if (globalWebPlayAccessPending) return;
  globalWebPlayAccessPending = true;
  render(true);
  try {
    const db = getPushHubDb();
    if (!db) throw new Error("The a2moring Firebase database is unavailable.");
    await db.ref("Admin/WV2").set(enabled);
    globalWebPlayAccessEnabled = enabled;
    globalWebPlayAccessError = "";
    toast(`Global WebPlay access ${enabled ? "enabled" : "disabled"}.`);
  } catch (error) {
    toast(`Could not update global WebPlay access: ${error.message}`, true);
  } finally {
    globalWebPlayAccessPending = false;
    render(true);
  }
}

function mergeLiveData(root) {
  const legacy = normalizeLegacyData(root);
  const adminData = root.adminData && typeof root.adminData === "object" ? root.adminData : {};
  const merged = { ...legacy, ...adminData };

  const mergeRecords = (source, additions, preferAdditions = false) => {
    const records = new Map(source.map((item) => [item.id, item]));
    for (const item of additions) {
      if (preferAdditions || !records.has(item.id)) records.set(item.id, item);
    }
    return Array.from(records.values());
  };
  merged.players = mergeRecords(legacy.players, Array.isArray(adminData.players) ? adminData.players : [])
    .map(player => {
      const legacyPlayer = legacy.players.find(item => item.id === player.id);
      if (!legacyPlayer) return player;
      const profile = root.DATA?.[player.mobile];
      return {
        ...legacyPlayer,
        ...player,
        played: legacyPlayer.played,
        totalAdded: profile && Object.prototype.hasOwnProperty.call(profile, "TD")
          ? legacyPlayer.totalAdded : Number.isFinite(Number(player.totalAdded)) ? Number(player.totalAdded) : legacyPlayer.totalAdded,
        totalWithdrawn: profile && Object.prototype.hasOwnProperty.call(profile, "TW")
          ? legacyPlayer.totalWithdrawn : Number.isFinite(Number(player.totalWithdrawn)) ? Number(player.totalWithdrawn) : legacyPlayer.totalWithdrawn,
      };
    });
  merged.markets = mergeRecords(legacy.markets, Array.isArray(adminData.markets) ? adminData.markets : []);
  const adminMarkets = new Map((Array.isArray(adminData.markets) ? adminData.markets : []).map((market) => [market.id, market]));
  for (const market of merged.markets) {
    const adminMarket = adminMarkets.get(market.id);
    if (!adminMarket || !Array.isArray(adminMarket.results)) continue;
    const results = new Map((market.results || []).map((item) => [`${item.session || ""}|${item.date}`, item]));
    for (const item of adminMarket.results) {
      const key = `${item.session || ""}|${item.date}`;
      if (!results.has(key)) results.set(key, item);
    }
    market.results = Array.from(results.values()).sort((left, right) => String(right.date).localeCompare(String(left.date)));
  }
  merged.requests = mergeRecords(legacy.requests, Array.isArray(adminData.requests) ? adminData.requests : [], true);
  merged.transactions = mergeRecords(legacy.transactions, Array.isArray(adminData.transactions) ? adminData.transactions : [], true);
  merged.bets = mergeRecords(legacy.bets, Array.isArray(adminData.bets) ? adminData.bets : [], true);
  const playedByMobile = new Map();
  for (const bet of merged.bets) {
    const mobile = String(bet.mobile || bet.playerId || "");
    if (/^\d{10,}$/.test(mobile)) {
      playedByMobile.set(mobile, (playedByMobile.get(mobile) || 0) + (Number(bet.points) || 0));
    }
  }
  for (const player of merged.players) player.played = playedByMobile.get(player.mobile) || 0;

  if (!Array.isArray(adminData.players) && !legacy.players.length) merged.players = [];
  if (!Array.isArray(adminData.markets) && !legacy.markets.length) merged.markets = [];
  if (!Array.isArray(adminData.requests) && !legacy.requests.length) merged.requests = [];
  if (!Array.isArray(adminData.transactions) && !legacy.transactions.length) merged.transactions = [];
  if (!Array.isArray(adminData.bets) && !legacy.bets.length) merged.bets = [];
  if (Array.isArray(adminData.rates) && !root["Rate Chart"]) merged.rates = adminData.rates;
  else if (!root["Rate Chart"]) merged.rates = legacy.rates;

  if (root["Rate Chart"] && typeof root["Rate Chart"] === "object") {
    merged.rates = legacy.rates;
  }
  merged.settings = { ...legacy.settings };
  for (const [key, value] of Object.entries(adminData.settings || {})) {
    if (key !== "noticeMessage" && JSON.stringify(value) !== JSON.stringify(defaultData.settings[key])) {
      merged.settings[key] = value;
    }
  }
  return normalizeData(merged);
}

let data = createEmptyData();
let todayLoginCount = 0;
let todayNewUsers = [];
let gameAccessByMobile = new Set();
let lastSeenByMobile = new Map();
let lastSyncedData = null;
let lastPersistPromise = Promise.resolve(true);
let databaseRef;
let databaseRootRef;
let adminCredentialRef;
let adminCredentialFingerprint = "";
let adminAuthenticated = false;
let loginInProgress = false;
let globalWebPlayAccessEnabled = null;
let globalWebPlayAccessError = "";
let globalWebPlayAccessPending = false;
let globalWebPlayAccessRef;
const webPlayAccessByMobile = new Map();
const webPlayAccessListeners = new Map();
const webPlayAccessPending = new Set();
let currentPage = "dashboard";
let requestFilter = "All";
let requestDateSelection = localDateKey();
const requestsInProgress = new Set();
const playerDeletionsInProgress = new Set();
let playerQuery = "";
let playerStatusFilter = "All";
let transactionQuery = "";
let requestQuery = "";
let playedQuery = "";
let playedPlayerFilter = "All";
let playedMarketFilter = "All";
let playerHistorySearch = "";
let resultMarketSelection = "";
let resultSessionSelection = "Open";
let resultDateSelection = localDateKey();
let resultPanelDraft = "";
let selectedPlayerId = "";
let betSlip = [];
let legacyMarketKeys = new Map();

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
}

function normalizedAdminPhone(value) {
  return String(decodeLegacyValue(value) ?? "").replace(/\D/g, "");
}

function normalizedAdminPassword(value) {
  const decoded = decodeLegacyValue(value);
  return decoded === null || decoded === undefined ? "" : String(decoded);
}

async function adminPasswordFingerprint(value) {
  if (!globalThis.crypto?.subtle) throw new Error("Secure sign-in verification is unavailable in this browser.");
  const bytes = new TextEncoder().encode(normalizedAdminPassword(value));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

async function verifyAdminLogin(phone, password) {
  if (typeof firebase === "undefined") throw new Error("Sign-in is temporarily unavailable. Check your connection and try again.");
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  const snapshot = await firebase.database().ref("Admin/Admin").once("value");
  const credentials = decodeLegacyValue(snapshot.val());
  if (!credentials || typeof credentials !== "object") {
    throw new Error("Admin sign-in is not configured. Ask the administrator to check the admin credentials.");
  }
  const expectedPhone = normalizedAdminPhone(credentials.NumAdmin);
  const expectedPassword = normalizedAdminPassword(credentials.PassAdmin);
  if (!expectedPhone || !expectedPassword.trim()) {
    throw new Error("Admin sign-in is not configured. Ask the administrator to check the admin credentials.");
  }
  if (normalizedAdminPhone(phone) !== expectedPhone || normalizedAdminPassword(password) !== expectedPassword) {
    throw new Error("Phone number or password is incorrect.");
  }
  return {
    credentialFingerprint: await adminPasswordFingerprint(expectedPassword),
  };
}

function setAdminAppVisible(visible) {
  adminAuthenticated = visible;
  document.getElementById("admin-session-check").hidden = true;
  document.getElementById("admin-login").hidden = visible;
  document.getElementById("admin-app").hidden = !visible;
}

function monitorAdminPassword(fingerprint) {
  if (adminCredentialRef) adminCredentialRef.off();
  adminCredentialFingerprint = fingerprint;
  adminCredentialRef = firebase.database().ref("Admin/Admin/PassAdmin");
  adminCredentialRef.on("value", async (snapshot) => {
    if (!adminAuthenticated || !adminCredentialFingerprint) return;
    try {
      const currentFingerprint = await adminPasswordFingerprint(snapshot.val());
      if (currentFingerprint !== adminCredentialFingerprint) {
        signOutAdmin("The admin password changed. Sign in again with the new password.");
      }
    } catch (error) {
      toast(`Could not verify the admin password change listener: ${error.message}`, true);
      signOutAdmin("Password-change monitoring failed. Sign in again.");
    }
  }, (error) => {
    toast(`Could not monitor admin password changes: ${error.message}`, true);
    signOutAdmin("Password-change monitoring is unavailable. Sign in again.");
  });
}

function signOutAdmin(message = "") {
  closeBroadcastSession();
  if (adminCredentialRef) adminCredentialRef.off();
  adminCredentialRef = undefined;
  adminCredentialFingerprint = "";
  if (globalWebPlayAccessRef) globalWebPlayAccessRef.off();
  globalWebPlayAccessRef = undefined;
  for (const ref of webPlayAccessListeners.values()) ref.off();
  webPlayAccessListeners.clear();
  webPlayAccessByMobile.clear();
  webPlayAccessPending.clear();
  globalWebPlayAccessEnabled = null;
  globalWebPlayAccessError = "";
  globalWebPlayAccessPending = false;
  if (databaseRootRef) databaseRootRef.off();
  databaseRef = undefined;
  databaseRootRef = undefined;
  adminExpertGuessing = {};
  adminExpertGuessingLoaded = false;
  adminExpertGuessingLoadInProgress = false;
  adminExpertGuessingSeedInProgress = false;
  withdrawalWindowsSeedStarted = false;
  generatedExpertGuessing.clear();
  lastSyncedData = null;
  data = createEmptyData();
  todayLoginCount = 0;
  todayNewUsers = [];
  gameAccessByMobile = new Set();
  lastSeenByMobile = new Map();
  currentPage = "dashboard";
  localStorage.removeItem(ADMIN_SESSION_KEY);
  localStorage.removeItem(ADMIN_CREDENTIAL_FINGERPRINT_KEY);
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  document.getElementById("sidebar").classList.remove("open");
  document.querySelector(".mobile-menu").setAttribute("aria-expanded", "false");
  document.getElementById("modal-root").innerHTML = "";
  document.getElementById("toast-root").innerHTML = "";
  setAdminAppVisible(false);
  document.getElementById("admin-login-form").reset();
  document.getElementById("admin-login-error").textContent = "";
  if (message) document.getElementById("admin-login-error").textContent = message;
  document.getElementById("admin-phone").focus();
}

function setConnectionStatus(title, detail, state) {
  const indicator = document.getElementById("connection-indicator");
  document.getElementById("connection-title").textContent = title;
  document.getElementById("connection-detail").textContent = detail;
  indicator.dataset.state = state;
}

function legacyUpdatesFor(changed, previous) {
  const updates = {};
  const oldSettings = previous.settings || {};
  if (changed.rates && Object.prototype.hasOwnProperty.call(changed, "rates")) {
    changed.rates.forEach((rate, index) => {
      updates[`Rate Chart/${index + 1}`] = String(rate.value);
    });
  }
  if (changed.settings && changed.settings.noticeMessage !== oldSettings.noticeMessage) {
    updates["Notice/Notice"] = changed.settings.noticeMessage;
  }
  if (changed.settings && changed.settings.maintenance !== oldSettings.maintenance) {
    updates["Admin/Admin/Maintanance"] = String(changed.settings.maintenance);
  }
  const playerSettings = [
    ["newRegistrations", "EnableNewRegistrations"],
    ["openBets", "EnableOpenBets"],
    ["closeBets", "EnableCloseBets"],
    ["signUpBonus", "Sign Up Bonus"],
    ["minimumDeposit", "MD"],
    ["qrCodeEnabled", "QrCodeEnabled"],
    ["directPaymentEnabled", "DirectPaymentEnabled"],
    ["paymentGatewayEnabled", "PaymentGatewayEnabled"],
    ["qrCode", "Qr Code"],
    ["upiId", "upi_id"],
    ["upiUrlTemplate", "Admin Upi"],
    ["paymentGatewayUrl", "payment_api_url"],
    ["minimumWithdrawal", "MW"],
    ["minimumEntry", "Min Entry"],
    ["maximumEntry", "Max Entry"],
    ["withdrawTiming", "Withdraw Timing"],
    ["policy", "Policy"],
    ["websiteUrl", "Website"],
    ["matka60Url", "matka60url"],
    ["matka30Url", "matka30url"],
    ["contactUrl", "Contact"],
    ["telegramUrl", "Telegram"],
    ["resultChartUrl", "Market_Reult_chart_Web"],
  ];
  for (const [property, key] of playerSettings) {
    if (changed.settings && changed.settings[property] !== oldSettings[property]) {
      updates[`Admin/Admin/${key}`] = String(changed.settings[property] ?? "");
    }
  }
  if (changed.settings &&
      (!oldSettings.withdrawalWindowsConfigured ||
       JSON.stringify(changed.settings.withdrawalWindows) !== JSON.stringify(oldSettings.withdrawalWindows))) {
    updates["Admin/Admin/WRTiming"] = changed.settings.withdrawalWindows;
  }
  if (Array.isArray(changed.players)) {
    const previousPlayers = new Map((previous.players || []).map((player) => [player.id, player]));
    const currentPlayers = new Map(changed.players.map((player) => [player.id, player]));
    for (const player of changed.players) {
      const oldPlayer = previousPlayers.get(player.id);
      if (!oldPlayer || !/^\d{10,}$/.test(player.mobile)) continue;
      if (player.name !== oldPlayer.name) updates[`DATA/${player.mobile}/name`] = player.name;
      if (player.balance !== oldPlayer.balance && player.balanceField) {
        updates[`DATA/${player.mobile}/${player.balanceField}`] = String(player.balance);
      }
      if (player.totalAdded !== oldPlayer.totalAdded) updates[`DATA/${player.mobile}/TD`] = String(player.totalAdded || 0);
      if (player.totalWithdrawn !== oldPlayer.totalWithdrawn) updates[`DATA/${player.mobile}/TW`] = String(player.totalWithdrawn || 0);
      if (player.status !== oldPlayer.status) {
        const blocked = player.status === "Blocked";
        updates[`DATA/${player.mobile}/blocked`] = blocked ? "yes" : "no";
        updates[`Blocked/${player.mobile}`] = blocked ? true : null;
      }
    }
    for (const oldPlayer of previous.players || []) {
      if (currentPlayers.has(oldPlayer.id) || !/^\d{10,}$/.test(String(oldPlayer.mobile || ""))) continue;
      updates[`DATA/${oldPlayer.mobile}`] = null;
      updates[`Blocked/${oldPlayer.mobile}`] = null;
    }
    if (Array.isArray(changed.transactions)) {
      const previousTransactionIds = new Set((previous.transactions || []).map(transaction => transaction.id));
      for (const transaction of changed.transactions) {
        if (!transaction.id || previousTransactionIds.has(transaction.id) || !/^\d{10,}$/.test(String(transaction.mobile || ""))) continue;
        updates[`DATA/${transaction.mobile}/transactions/${safeMarkerKey(transaction.id)}`] = transaction;
      }
    }
  }
  if (Array.isArray(changed.requests)) {
    const currentRequests = new Map(changed.requests.map((request) => [request.id, request]));
    for (const request of previous.requests || []) {
      const match = request.id.match(/^(WR|DR)-(.+)$/);
      const updated = currentRequests.get(request.id);
      if (match && updated && updated.status !== request.status && Array.isArray(request.legacyValue)) {
        const fields = request.legacyValue.slice();
        fields[fields.length - 1] = updated.status;
        updates[`${match[1]}/${match[2]}`] = JSON.stringify(fields);
      }
    }
  }
  if (Array.isArray(changed.markets)) {
    const currentMarkets = new Map(changed.markets.map((market) => [market.id, market]));
    for (const oldMarket of previous.markets || []) {
      const currentMarket = currentMarkets.get(oldMarket.id);
      const previousEntries = marketLegacyEntries(oldMarket);
      const currentEntries = currentMarket ? marketLegacyEntries(currentMarket) : {};
      for (const [source, key] of Object.entries(previousEntries)) {
        if (currentEntries[source] !== key) updates[`${source}/${key}`] = null;
      }
    }
    for (const market of changed.markets) {
      const entries = marketLegacyEntries(market);
      if (!Object.keys(entries).length || !Array.isArray(market.legacyFields)) continue;
      const oldMarket = (previous.markets || []).find((item) => item.id === market.id);
      if (oldMarket
        && JSON.stringify(market) === JSON.stringify(oldMarket)) continue;
      const fields = market.legacyFields.slice();
      fields[0] = market.name;
      fields[1] = legacyMarketTime(market.open);
      fields[2] = legacyMarketTime(market.close);
      fields[5] = market.status === "Open" ? "Running" : "Stop";
      if (market.result && market.result !== "—") fields[6] = market.result;
      fields[7] = String(market.position);
      fields[8] = JSON.stringify({
        id: market.id,
        days: normalizedMarketDays(market.days),
        resultDate: market.resultDate || "",
      });
      for (const [source, key] of Object.entries(entries)) {
        updates[`${source}/${key}`] = JSON.stringify(fields);
      }
    }
    const previousMarkets = new Map((previous.markets || []).map((market) => [market.id, market]));
    for (const market of changed.markets) {
      const oldResults = new Map((previousMarkets.get(market.id)?.results || []).map((item) => [`${item.session || ""}|${item.date}`, item.result]));
      for (const result of market.results || []) {
        const date = String(result.date || "");
        const marketKey = market.name.replace(/[.#$\[\]/]/g, "_");
        const key = `${result.session || ""}|${date}`;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !result.result || oldResults.get(key) === result.result) continue;
        updates[`Results/${marketKey}/${date}`] = result.result;
      }
    }
  }
  if (Array.isArray(changed.bets)) {
    const previousBets = new Map((previous.bets || []).map((bet) => [bet.id, bet]));
    for (const bet of changed.bets) {
      const oldBet = previousBets.get(bet.id);
      if (!oldBet || bet.number === oldBet.number) continue;
      if (bet.legacyHistoryPath && bet.legacyDetailPath && Array.isArray(bet.legacyDetailValue)) {
        if (oldBet.legacyDetailPath && oldBet.legacyDetailPath !== bet.legacyDetailPath) {
          updates[oldBet.legacyDetailPath] = null;
        }
        updates[bet.legacyHistoryPath] = bet.legacyHistoryValue;
        updates[bet.legacyDetailPath] = JSON.stringify(bet.legacyDetailValue);
      }
    }
  }
  return updates;
}

function persist(message = "Changes saved.") {
  data.updatedAt = new Date().toISOString();
  const snapshot = structuredClone(data);
  const previous = lastSyncedData || createEmptyData();
  const changed = {};
  for (const key of Object.keys(snapshot)) {
    if (JSON.stringify(snapshot[key]) !== JSON.stringify(previous[key])) changed[key] = snapshot[key];
  }
  if (!databaseRef) {
    toast("Connection unavailable. Changes could not be saved.", true);
    lastPersistPromise = Promise.resolve(false);
    return lastPersistPromise;
  }
  if (Object.keys(changed).length === 0) {
    lastPersistPromise = Promise.resolve(true);
    return lastPersistPromise;
  }
  const updates = {};
  for (const [key, value] of Object.entries(changed)) updates[`adminData/${key}`] = value;
  const legacyUpdates = legacyUpdatesFor(changed, previous);
  Object.assign(updates, legacyUpdates);
  lastPersistPromise = databaseRootRef.update(updates).then(() => {
    lastSyncedData = snapshot;
    if (message) toast(message);
    return true;
  }).catch((error) => {
    setConnectionStatus("Sync error", "Check database access rules", "error");
    toast(`Save failed: ${error.message}`, true);
    return false;
  });
  return lastPersistPromise;
}

function money(amount) {
  return `₹${Number(amount || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function updateTopbarTotals() {
  const root = document.getElementById("topbar-totals");
  if (!root) return;
  const today = localDateKey();
  const played = data.bets
    .filter((bet) => resultDateForBid(bet) === today)
    .reduce((sum, bet) => sum + (Number(bet.points) || 0), 0);
  const won = allPublishedWinners(today)
    .reduce((sum, winner) => sum + winner.winningAmount, 0);
  root.innerHTML = `<div class="topbar-total played"><span>Played today</span><strong>${money(played)}</strong></div><div class="topbar-total won"><span>Won today</span><strong>${money(won)}</strong></div>`;
}

function dateLabel(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function toast(message, isError = false) {
  const root = document.getElementById("toast-root");
  const item = document.createElement("div");
  item.className = `toast${isError ? " error" : ""}`;
  item.textContent = message;
  root.append(item);
  window.setTimeout(() => item.remove(), 3300);
}

function pendingRequests(kind) {
  if (kind) return data.requests.filter((request) => request.kind === kind && request.status === "Pending").length;
  return data.requests.filter((request) => request.status === "Pending").length;
}

function setNav() {
  const root = document.getElementById("navigation");
  root.innerHTML = navigation.map((item) => {
    if (item.section) return `<div class="nav-section">${item.section}</div>`;
    const count = item.count === "deposit-pending"
      ? pendingRequests("Deposit")
      : item.count === "withdrawal-pending"
        ? pendingRequests("Withdrawal")
        : item.count;
    return `<button class="nav-link${currentPage === item.id ? " active" : ""}" data-page="${item.id}"><span class="nav-icon">${item.icon}</span>${item.label}${count ? `<span class="nav-count">${count}</span>` : ""}</button>`;
  }).join("");
}

function pageHeading(title, subtitle, actions = "") {
  return `<div class="page-heading"><div><h1>${title}</h1><p>${subtitle}</p></div><div class="heading-actions">${actions}</div></div>`;
}

function button(label, action, style = "", extra = "") {
  return `<button class="button ${style}" data-action="${action}" ${extra}>${label}</button>`;
}

function iconCard(id, title, subtitle, page) {
  const image = icons[id];
  return `<button class="quick-card" data-page="${page}">${image ? `<img src="admin-${image}" alt="">` : `<span class="quick-fallback">${title.slice(0, 1)}</span>`}<strong>${title}</strong><small>${subtitle}</small></button>`;
}

function statusTag(value) {
  return `<span class="status ${escapeHtml(value.toLowerCase())}">${escapeHtml(value)}</span>`;
}

function marketRows(markets = data.markets.slice(0, 5), date = localDateKey()) {
  if (!markets.length) return `<div class="empty-state">No markets have been added yet.</div>`;
  return markets.map((market) => {
    const results = marketResultsForDate(market, date).filter((item) => item.result);
    const result = results.length
      ? results.map((item) => `${item.session ? `${item.session}: ` : ""}${item.result}`).join(" · ")
      : "—";
    return `<div class="market-row"><span class="market-mark">${escapeHtml(market.name.slice(0, 2).toUpperCase())}</span><div class="market-info"><strong>${escapeHtml(market.name)}</strong><small>${escapeHtml(market.type)} · ${escapeHtml(market.open)} — ${escapeHtml(market.close)}</small></div>${statusTag(market.status)}<span class="market-result">${escapeHtml(result)}</span></div>`;
  }).join("");
}

function activityRows(date) {
  return data.transactions.filter((item) => transactionDateKey(item) === date).slice(0, 5).map((transaction) => {
    const positive = transaction.amount >= 0;
    const symbol = transaction.type === "Added" ? "+" : transaction.type === "Winning" ? "★" : "↗";
    const amount = transaction.amountUnavailable ? "—" : `${positive ? "+" : ""}${money(transaction.amount)}`;
    return `<div class="activity-row"><span class="activity-icon">${symbol}</span><div class="activity-copy"><strong>${escapeHtml(transaction.player)}</strong> · ${escapeHtml(transaction.type)} <small>${escapeHtml(transaction.note)} · ${escapeHtml(transaction.date)}</small><small>Last seen · ${escapeHtml(lastSeenLabel(transaction.mobile))}</small></div><strong style="color:${positive ? "#16866f" : "#687589"}">${amount}</strong></div>`;
  }).join("") || `<div class="empty-state">No recent activity.</div>`;
}

function reportDateFilter() {
  const date = resultDateSelection || localDateKey();
  return `<section class="panel date-filter-panel"><div class="form-field"><label for="activity-date">Show data for date</label><input id="activity-date" class="field" type="date" value="${escapeHtml(date)}" max="${escapeHtml(localDateKey())}"></div></section>`;
}

function transactionDateKey(item) {
  const raw = String(item.date || item.createdAt || "");
  const iso = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const legacy = raw.match(/^(\d{2})-(\d{2})-(\d{4})/);
  if (legacy) return `${legacy[3]}-${legacy[2]}-${legacy[1]}`;
  const localized = raw.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})/);
  if (localized) {
    const first = Number(localized[1]);
    const second = Number(localized[2]);
    const day = first > 12 ? first : second > 12 ? second : first;
    const month = first > 12 ? second : second > 12 ? first : second;
    return `${localized[3]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? "" : localDateKey(new Date(parsed));
}

function requestDateKey(request) {
  return transactionDateKey({ date: request.created || request.date || request.createdAt || "" });
}

function recordManualWalletAdjustment(player, type, amount, note) {
  const timestamp = Date.now();
  const idSuffix = `${timestamp}-${Math.random().toString(36).slice(2, 8)}`;
  const created = new Date(timestamp).toLocaleString();
  const isDeposit = type === "Added";
  const kind = isDeposit ? "Deposit" : "Withdrawal";
  const details = String(note || (isDeposit ? "Admin entry" : "Admin wallet adjustment")).trim();
  const signedAmount = isDeposit ? amount : -amount;

  if (isDeposit) {
    void notifyUserByPhone(
      player.mobile,
      `Amount Credit ${money(amount)} by A2Morning`,
      details || `Wallet credited ${money(amount)}.`
    ).catch(err => console.warn("Credit push failed", err));
  }

  data.transactions.unshift({
    id: `T-${idSuffix}`,
    player: player.name,
    mobile: player.mobile,
    type,
    amount: signedAmount,
    date: created,
    note: details,
  });
  data.requests.unshift({
    id: `MANUAL-${idSuffix}`,
    player: player.name,
    mobile: player.mobile,
    kind,
    amount,
    method: "Admin wallet adjustment",
    details,
    created,
    status: "Approved",
    balanceDeducted: !isDeposit,
    source: "manual",
  });
}

function requestDateFilter() {
  const date = requestDateSelection || localDateKey();
  return `<section class="panel date-filter-panel"><div class="form-field"><label for="request-date">Show ${escapeHtml(date)} requests</label><input id="request-date" class="field" type="date" value="${escapeHtml(date)}" max="${escapeHtml(localDateKey())}"></div></section>`;
}

function dashboardPage() {
  const balance = data.players.reduce((sum, player) => sum + Number(player.balance || 0), 0);
  const totalCredits = data.players.reduce((sum, player) => sum + Number(player.totalAdded || 0), 0);
  const totalDemoCredits = data.transactions
    .filter((item) => item.demo === true)
    .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const totalPlayed = data.bets.reduce((sum, bet) => sum + (Number(bet.points) || 0), 0);
  const totalDistributed = data.settlements.reduce((sum, settlement) => sum + (Number(settlement.total) || 0), 0);
  const zeroBalancePlayers = data.players.filter((player) => Number(player.balance || 0) === 0).length;
  const nonzeroBalancePlayers = data.players.length - zeroBalancePlayers;
  const waiting = pendingRequests();
  const active = data.players.filter((player) => player.status === "Active").length;
  const date = resultDateSelection || localDateKey();
  const dateBets = data.bets.filter((bet) => resultDateForBid(bet) === date);
  const playedToday = dateBets.reduce((sum, bet) => sum + (Number(bet.points) || 0), 0);
  const dateTransactions = data.transactions.filter((item) => transactionDateKey(item) === date);
  const dailyDemoTransactions = dateTransactions.filter((item) => item.demo === true);
  const dailyDemoCredits = dailyDemoTransactions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const winners = allPublishedWinners().filter((winner) => winner.date === date);
  const winningAmount = winners.reduce((sum, winner) => sum + winner.winningAmount, 0);
  return `${pageHeading("Dashboard", "Your A2Morning operations at a glance.", button("＋ Add player", "add-player", "primary") + button("Update results", "go-results"))}
    ${reportDateFilter()}
    <section class="panel wallet-overview"><div class="panel-head"><div><h2>Wallet &amp; player balance overview</h2><p>Current wallet funds, total activity, and account counts</p></div></div><div class="grid three-col">
      <div class="metric-mini"><span>Total wallet remaining</span><strong>${money(balance)}</strong></div>
      <div class="metric-mini"><span>Total wallet credits added</span><strong>${money(totalCredits)}</strong></div>
      <div class="metric-mini"><span>Total DEMO test amounts · separate</span><strong>${money(totalDemoCredits)}</strong></div>
      <div class="metric-mini"><span>Total amount played</span><strong>${money(totalPlayed)}</strong></div>
      <div class="metric-mini"><span>Winnings distributed</span><strong>${money(totalDistributed)}</strong></div>
      <div class="metric-mini"><span>Users with zero balance</span><strong>${zeroBalancePlayers}</strong></div>
      <div class="metric-mini"><span>Users with balance</span><strong>${nonzeroBalancePlayers}</strong></div>
      <div class="metric-mini"><span>Total users</span><strong>${data.players.length}</strong></div>
    </div></section>
    <div class="grid stats-grid">
      <article class="stat-card"><div class="stat-top"><span>Total players</span><span class="stat-icon">♙</span></div><div class="stat-value">${data.players.length}</div><div class="stat-foot"><span class="up">${active} active</span> · ${data.players.length - active} blocked</div></article>
      <article class="stat-card"><div class="stat-top"><span>Today's logins</span><span class="stat-icon">↗</span></div><div class="stat-value">${todayLoginCount}</div><div class="stat-foot">New users · <button class="panel-link" data-page="new-users">View users →</button></div></article>
      <article class="stat-card"><div class="stat-top"><span>Wallet balances</span><span class="stat-icon">₹</span></div><div class="stat-value">${money(balance)}</div><div class="stat-foot">Across all player accounts</div></article>
      <article class="stat-card"><div class="stat-top"><span>Pending requests</span><span class="stat-icon">⇄</span></div><div class="stat-value">${waiting}</div><div class="stat-foot">${waiting ? "Needs your review" : "All requests reviewed"}</div></article>
      <article class="stat-card"><div class="stat-top"><span>Points added · ${escapeHtml(date)}</span><span class="stat-icon">↗</span></div><div class="stat-value">${money(dateTransactions.filter((item) => item.type === "Added").reduce((sum, item) => sum + item.amount, 0))}</div><div class="stat-foot">${dateTransactions.filter((item) => item.type === "Added").length} credits on selected date</div></article>
      <article class="stat-card"><div class="stat-top"><span>DEMO test amount · ${escapeHtml(date)}</span><span class="stat-icon">TEST</span></div><div class="stat-value">${money(dailyDemoCredits)}</div><div class="stat-foot">${dailyDemoTransactions.length} demo test${dailyDemoTransactions.length === 1 ? "" : "s"} · not real wallet credits</div></article>
      <article class="stat-card"><div class="stat-top"><span>Points withdrawn · ${escapeHtml(date)}</span><span class="stat-icon">↘</span></div><div class="stat-value">${money(Math.abs(dateTransactions.filter((item) => item.type === "Withdrawal").reduce((sum, item) => sum + item.amount, 0)))}</div><div class="stat-foot">Wallet withdrawals on selected date</div></article>
      <article class="stat-card"><div class="stat-top"><span>Played amount · ${escapeHtml(date)}</span><span class="stat-icon">▦</span></div><div class="stat-value">${money(playedToday)}</div><div class="stat-foot">${dateBets.length} bid${dateBets.length === 1 ? "" : "s"} on selected date · <button class="panel-link" data-page="played">View bids →</button></div></article>
      <article class="stat-card"><div class="stat-top"><span>Winning amount · ${escapeHtml(date)}</span><span class="stat-icon">★</span></div><div class="stat-value">${money(winningAmount)}</div><div class="stat-foot">${winners.length} winning bid${winners.length === 1 ? "" : "s"} · <button class="panel-link" data-page="winners">View winners →</button></div></article>
    </div>
    <div class="grid overview-grid">
      <section class="panel"><div class="panel-head"><div><h2>Market overview</h2><p>Market status and results for ${escapeHtml(date)}</p></div><button class="panel-link" data-page="markets">View all markets →</button></div><div class="market-list">${marketRows(data.markets.slice(0, 5), date)}</div></section>
      <section class="panel"><div class="panel-head"><div><h2>Wallet activity · ${escapeHtml(date)}</h2><p>Credits and withdrawals on the selected date</p></div><button class="panel-link" data-page="transactions">All activity →</button></div><div class="activity-list">${activityRows(date)}</div></section>
    </div>
    <section class="quick-section"><div class="section-heading"><h2>Quick access</h2><span>Manage your admin tools</span></div><div class="grid quick-grid">
      ${iconCard("players", "Players", "Search & manage", "players")}
      ${iconCard("requests", "Deposit requests", `${data.requests.filter(request => request.kind === "Deposit" && request.status === "Pending").length} awaiting review`, "deposit-requests")}
      ${iconCard("withdraw", "Withdrawal requests", `${data.requests.filter(request => request.kind === "Withdrawal" && request.status === "Pending").length} awaiting review`, "withdrawal-requests")}
      ${iconCard("markets", "Markets & games", "Schedules & status", "markets")}
      ${iconCard("results", "Update results", "Publish market results", "results")}
      ${iconCard("winners", "Winners", "Review winning bids", "winners")}
      ${iconCard("rates", "Change rates", "Game payout chart", "rates")}
      ${iconCard("notices", "Send notice", "Update player message", "notices")}
      ${iconCard("transactions", "Transactions", "Wallet history", "transactions")}
      ${iconCard("played", "Played games", "Player game activity", "played")}
      ${iconCard("reports", "Reports", "Account summaries", "reports")}
      ${iconCard("settings", "Game settings", "Maintenance & controls", "settings")}
      ${iconCard("blocked", "Blocked list", "Review blocked players", "players")}
      ${iconCard("add", "Add points", "Credit a player wallet", "players")}
    </div></section>`;
}

function playerTable(rows) {
  if (!rows.length) return `<div class="empty-state">No players match your search.</div>`;
  return `<div class="table-wrap"><table><thead><tr><th>Player</th><th>Mobile</th><th>Balance</th><th>Added</th><th>Withdrawn</th><th>Played</th><th>Joined</th><th>Last seen</th><th>Status</th><th>Game access</th><th>WebPlay access</th><th>Actions</th></tr></thead><tbody>${rows.map((player) => `<tr>
    <td><div class="table-primary"><span class="user-avatar">${escapeHtml(player.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase())}</span><span><strong>${escapeHtml(player.name)}</strong><small>${player.approved ? "Approved account" : "Awaiting approval"}</small></span></div></td>
    <td>${escapeHtml(player.mobile)}</td><td><strong>${money(player.balance)}</strong></td><td>${money(player.totalAdded)}</td><td>${money(player.totalWithdrawn)}</td><td>${money(player.played)}</td><td>${dateLabel(player.joined)}</td><td>${escapeHtml(lastSeenLabel(player.mobile))}</td><td>${statusTag(player.status)}</td><td>${gameAccessLabel(player.mobile)}</td><td>${webPlayAccessControl(player.mobile)}</td>
    <td><div class="actions-cell">${whatsappLink(player.mobile)}<button class="button small" data-action="edit-player" data-id="${escapeHtml(player.id)}" title="Edit player">Edit</button><button class="button small" data-action="player-credit" data-id="${escapeHtml(player.id)}" title="Add or withdraw points">₹</button><button class="button small ${player.status === "Blocked" ? "success" : "danger"}" data-action="toggle-player" data-id="${escapeHtml(player.id)}">${player.status === "Blocked" ? "Unblock" : "Block"}</button><button class="button small danger" data-action="delete-player" data-id="${escapeHtml(player.id)}" title="Delete player account">Delete</button></div></td>
  </tr>`).join("")}</tbody></table></div>`;
}

function playersPage() {
  const rows = data.players
    .filter((player) => `${player.name} ${player.mobile}`.toLowerCase().includes(playerQuery.toLowerCase()))
    .filter((player) => playerStatusFilter === "All" || (playerStatusFilter === "Pending" ? !player.approved : player.status === playerStatusFilter))
    .sort((left, right) => {
      const leftSeen = lastSeenTimestamp(left.mobile);
      const rightSeen = lastSeenTimestamp(right.mobile);
      if (leftSeen === null) return rightSeen === null ? 0 : 1;
      if (rightSeen === null) return -1;
      return rightSeen - leftSeen;
    });
  return `${pageHeading("Players", "Players are ordered by most recent last seen. Manage accounts, balances, approvals, and access.", button("＋ Add player", "add-player", "primary"))}
    <section class="panel"><div class="toolbar"><div class="search-wrap"><span class="search-mark">⌕</span><input id="player-search" class="field" type="search" placeholder="Search by name or mobile number..." value="${escapeHtml(playerQuery)}"></div><select id="player-status-filter" class="select"><option value="All">All statuses</option><option value="Active">Active</option><option value="Blocked">Blocked</option><option value="Pending">Needs approval</option></select><span class="stat-foot">${rows.length} player${rows.length === 1 ? "" : "s"}</span></div>${playerTable(rows)}</section>`;
}

function newUsersPage() {
  const dateKey = todayNewUsersDateKey();
  const rows = todayNewUsers.map(({ tag, value }) => {
    const valueMobile = typeof value === "string" && /^\d{10,}$/.test(value) ? value : "";
    const player = data.players.find((item) => item.id === tag || item.mobile === tag)
      || (valueMobile ? data.players.find((item) => item.mobile === valueMobile) : null);
    const mobile = player?.mobile || (/^\d{10,}$/.test(tag) ? tag : valueMobile);
    const displayName = player?.name
      || (typeof value === "string" && value.trim() && !/^\d{10,}$/.test(value) ? value : tag);
    return `<tr><td><strong>${escapeHtml(displayName)}</strong></td><td>${escapeHtml(mobile || "—")}</td><td><code>${escapeHtml(tag)}</code></td><td>${escapeHtml(lastSeenLabel(mobile))}</td><td>${gameAccessLabel(mobile)}</td><td>${webPlayAccessControl(mobile)}</td><td>${whatsappLink(mobile) || "—"}</td></tr>`;
  }).join("");
  return `${pageHeading("Today's new users", `Users who joined on ${dateKey}.`)}
    <section class="panel"><div class="panel-head"><div><h2>Today’s logins</h2></div><span class="status active">${todayNewUsers.length} user${todayNewUsers.length === 1 ? "" : "s"}</span></div>
      ${rows ? `<div class="table-wrap"><table><thead><tr><th>Player</th><th>Mobile</th><th>User tag</th><th>Last seen</th><th>Game access</th><th>WebPlay access</th><th>Contact</th></tr></thead><tbody>${rows}</tbody></table></div>` : `<div class="empty-state">No users have been recorded for ${dateKey} yet.</div>`}
    </section>`;
}

function requestsPage() {
  const rows = data.requests.filter((request) => (requestFilter === "All" || request.status === requestFilter) && `${request.player} ${request.mobile} ${request.kind} ${request.method} ${request.details || ""}`.toLowerCase().includes(requestQuery.toLowerCase()));
  return `${pageHeading("Payment requests", "Withdrawal points are reserved when submitted. Refund restores them; Delete removes the request without refunding.", button("＋ Record payment", "manual-payment", "primary"))}
    <section class="panel"><div class="toolbar"><div class="search-wrap"><span class="search-mark">⌕</span><input id="request-search" class="field" type="search" placeholder="Search player, mobile, or method..." value="${escapeHtml(requestQuery)}"></div><select id="request-filter" class="select">${["All", "Pending", "Approved", "Refunded", "Rejected", "Failed", "Cancelled", "Deleted"].map((value) => `<option${requestFilter === value ? " selected" : ""}>${value}</option>`).join("")}</select><span class="stat-foot">${rows.length} request${rows.length === 1 ? "" : "s"}</span></div>
    ${rows.length ? `<div class="table-wrap"><table><thead><tr><th>Player</th><th>Last seen</th><th>Request</th><th>Amount</th><th>Method &amp; details</th><th>Submitted</th><th>Status</th><th>Action</th></tr></thead><tbody>${rows.map((request) => `<tr><td><div class="table-primary"><span class="user-avatar">${escapeHtml(request.player[0])}</span><span><strong>${escapeHtml(request.player)}</strong><small>${escapeHtml(request.mobile)}</small></span></div></td><td>${escapeHtml(lastSeenLabel(request.mobile))}</td><td>${escapeHtml(request.kind)}</td><td><strong>${request.amountUnavailable ? "—" : money(request.amount)}</strong></td><td>${escapeHtml(request.method)}${request.details ? `<small style="display:block;max-width:280px;white-space:normal;color:#687589;margin-top:3px">${escapeHtml(request.details)}</small>` : ""}</td><td>${escapeHtml(request.created)}</td><td>${statusTag(request.status)}</td><td>${request.status === "Pending" ? `<div class="actions-cell"><button class="button small success" data-action="resolve-request" data-id="${escapeHtml(request.id)}" data-status="Approved" ${request.amountUnavailable ? "disabled title=\"Legacy request amount is not mapped\"" : ""}>Approve</button>${request.kind === "Withdrawal" ? `<button class="button small danger" data-action="resolve-request" data-id="${escapeHtml(request.id)}" data-status="Refunded" ${request.amountUnavailable || (request.balanceDeducted && !data.players.some((player) => player.mobile === request.mobile)) ? "disabled title=\"Player or refund amount is unavailable\"" : ""}>Refund</button><button class="button small" data-action="resolve-request" data-id="${escapeHtml(request.id)}" data-status="Cancelled" ${request.amountUnavailable || (request.balanceDeducted && !data.players.some((player) => player.mobile === request.mobile)) ? "disabled title=\"Player or reserved balance is unavailable\"" : ""}>Cancel request</button>` : `<button class="button small danger" data-action="resolve-request" data-id="${escapeHtml(request.id)}" data-status="Rejected">Reject</button>`}<button class="button small" data-action="resolve-request" data-id="${escapeHtml(request.id)}" data-status="Deleted">Delete</button></div>` : "—"}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty-state">No requests match this filter.</div>`}</section>`;
}

function requestKindPage(kind) {
  const label = kind === "Deposit" ? "Deposit" : "Withdrawal";
  const date = requestDateSelection || localDateKey();
  const matchesSearch = (request) => `${request.player} ${request.mobile} ${request.method} ${request.details || ""}`.toLowerCase().includes(requestQuery.toLowerCase());
  const pending = data.requests
    .filter(request => request.kind === kind && request.status === "Pending")
    .filter(matchesSearch)
    .sort((left, right) => requestDateKey(right).localeCompare(requestDateKey(left)));
  const rows = data.requests
    .filter(request => request.kind === kind && request.status !== "Pending")
    .filter(request => requestDateKey(request) === date)
    .filter(request => requestFilter === "All" || request.status === requestFilter)
    .filter(matchesSearch);
  const subtitle = kind === "Deposit"
    ? "Review UPI payments and approve verified requests to credit points."
    : "Review withdrawal requests. Submitted withdrawals reserve points; refunds restore them.";
  const rowsMarkup = (items) => items.map(request => {
    const busy = requestsInProgress.has(request.id);
    const approval = kind === "Deposit" ? "Approve & credit" : "Approve";
    const controls = request.status !== "Pending" ? "—" : `<div class="actions-cell">
      <button class="button small success" data-action="resolve-request" data-id="${escapeHtml(request.id)}" data-status="Approved" ${busy || request.amountUnavailable ? "disabled" : ""}>${busy ? "Processing…" : approval}</button>
      ${kind === "Withdrawal"
        ? `<button class="button small danger" data-action="resolve-request" data-id="${escapeHtml(request.id)}" data-status="Refunded" ${busy || request.amountUnavailable || (request.balanceDeducted && !data.players.some(player => player.mobile === request.mobile)) ? "disabled" : ""}>Refund</button><button class="button small" data-action="resolve-request" data-id="${escapeHtml(request.id)}" data-status="Cancelled" ${busy || request.amountUnavailable || (request.balanceDeducted && !data.players.some(player => player.mobile === request.mobile)) ? "disabled" : ""}>Cancel request</button>`
        : `<button class="button small danger" data-action="resolve-request" data-id="${escapeHtml(request.id)}" data-status="Rejected" ${busy ? "disabled" : ""}>Reject</button>`}
    </div>`;
    return `<tr><td><div class="table-primary"><span class="user-avatar">${escapeHtml(request.player[0] || "?")}</span><span><strong>${escapeHtml(request.player)}</strong><small>${escapeHtml(request.mobile || "—")}</small></span></div></td><td>${escapeHtml(lastSeenLabel(request.mobile))}</td><td><strong>${request.amountUnavailable ? "—" : money(request.amount)}</strong></td><td>${escapeHtml(request.method)}${request.details ? `<small style="display:block;max-width:280px;white-space:normal;color:#687589;margin-top:3px">${escapeHtml(request.details)}</small>` : ""}</td><td>${escapeHtml(request.created || "—")}</td><td>${statusTag(request.status)}</td><td>${controls}</td></tr>`;
  }).join("");
  const headers = `<thead><tr><th>Player</th><th>Last seen</th><th>Amount</th><th>Payment details</th><th>Submitted</th><th>Status</th><th>Action</th></tr></thead>`;
  const pendingTotal = pending.reduce((sum, request) => sum + (Number(request.amount) || 0), 0);
  const demoDeposits = kind === "Deposit"
    ? data.transactions.filter(item => item.demo === true
      && transactionDateKey(item) === date
      && `${item.player} ${item.mobile} ${item.id} ${item.note}`.toLowerCase().includes(requestQuery.toLowerCase()))
    : [];
  const demoDepositTotal = demoDeposits.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const demoDepositRows = demoDeposits.map(item => `<tr><td><div class="table-primary"><span class="user-avatar">D</span><span><strong>${escapeHtml(item.player || "Player")}</strong><small>${escapeHtml(item.mobile || "—")}</small></span></div></td><td><strong>${money(item.amount)}</strong></td><td><code>${escapeHtml(item.id)}</code></td><td>${escapeHtml(item.date || "—")}</td><td>${statusTag("DEMO ONLY")}</td></tr>`).join("");
  return `${pageHeading(`${label} requests`, subtitle, button("＋ Add points manually", "manual-payment", "primary"))}
    ${requestDateFilter()}
    <section class="panel pending-request-panel"><div class="panel-head"><div><h2>Pending ${label.toLowerCase()} requests · all dates</h2><p>Unapproved requests remain visible here regardless of the selected date.</p></div><strong>${pending.length} pending · ${money(pendingTotal)}</strong></div>
    ${pending.length ? `<div class="table-wrap"><table>${headers}<tbody>${rowsMarkup(pending)}</tbody></table></div>` : `<div class="empty-state">No pending ${label.toLowerCase()} requests.</div>`}</section>
    <section class="panel" style="margin-top:15px"><div class="panel-head"><div><h2>${label} history · ${escapeHtml(date)}</h2><p>Completed requests for the selected date.</p></div></div><div class="toolbar"><div class="search-wrap"><span class="search-mark">⌕</span><input id="request-search" class="field" type="search" placeholder="Search player, mobile, or payment details..." value="${escapeHtml(requestQuery)}"></div><select id="request-filter" class="select">${["All", "Pending", "Approved", "Refunded", "Rejected", "Failed", "Cancelled", "Deleted"].map(value => `<option${value === requestFilter ? " selected" : ""}>${value}</option>`).join("")}</select><span class="stat-foot">${rows.length} ${label.toLowerCase()} request${rows.length === 1 ? "" : "s"}</span></div>
    ${rows.length ? `<div class="table-wrap"><table>${headers}<tbody>${rowsMarkup(rows)}</tbody></table></div>` : `<div class="empty-state">No completed ${label.toLowerCase()} requests match ${escapeHtml(date)}.</div>`}</section>
    ${kind === "Deposit" ? `<section class="panel" style="margin-top:15px"><div class="panel-head"><div><h2>DEMO deposit test history · ${escapeHtml(date)}</h2><p>Separate test records only. They do not represent approved deposits or real wallet credits.</p></div><strong>${demoDeposits.length} tests · ${money(demoDepositTotal)}</strong></div>${demoDeposits.length ? `<div class="table-wrap"><table><thead><tr><th>Player</th><th>Test amount</th><th>Demo order ID</th><th>Submitted</th><th>Label</th></tr></thead><tbody>${demoDepositRows}</tbody></table></div>` : `<div class="empty-state">No demo deposit tests match ${escapeHtml(date)}.</div>`}</section>` : ""}`;
}

function marketsPage() {
  return `${pageHeading("Markets & games", "Manage market schedules, open/close status, and results.", button("＋ Add market", "add-market", "primary"))}
    <div class="grid two-col">${[...data.markets].sort((left, right) =>
      String(left.legacySource || "GAMES").localeCompare(String(right.legacySource || "GAMES")) || Number(left.position) - Number(right.position) || left.name.localeCompare(right.name)
    ).map((market) => {
      const result = market.resultDate === localDateKey() && !marketResultWasReset(market)
        ? market.result
        : market.type === "Starline" ? "### - #" : "### - ## - ###";
      return `<article class="market-card"><div class="market-card-top"><div><h3>${escapeHtml(market.name)}</h3><p>${escapeHtml(market.type)} · ${escapeHtml(marketDaysLabel(market.days || marketDaysForSource(market.legacySource || "GAMES")))}</p></div>${statusTag(market.status)}</div><div class="market-details"><span>◷ ${escapeHtml(market.open)} – ${escapeHtml(market.close)}</span><span>Position ${escapeHtml(market.position)}</span></div><div class="result-display">${resultBreakdownMarkup(result)}</div><div class="button-row" style="margin-top:13px"><button class="button small" data-action="edit-market" data-id="${escapeHtml(market.id)}">Edit market</button><button class="button small" data-action="edit-result" data-id="${escapeHtml(market.id)}">Update result</button><button class="button small ${market.status === "Open" ? "danger" : "success"}" data-action="toggle-market" data-id="${escapeHtml(market.id)}">${market.status === "Open" ? "Close" : "Open"}</button><button class="button small danger" data-action="delete-market" data-id="${escapeHtml(market.id)}">Delete</button></div></article>`;
    }).join("") || `<div class="panel empty-state">No markets added yet.</div>`}</div>`;
}

function resultsPage() {
  const market = data.markets.find((item) => item.id === resultMarketSelection) || data.markets[0];
  if (market && !data.markets.some((item) => item.id === resultMarketSelection)) resultMarketSelection = market.id;
  const date = resultDateSelection;
  const sameDayResults = marketResultsForDate(market, date);
  const storedResult = sameDayResults.find((item) => normalizedResultSession(item.session) === resultSessionSelection)?.result
    || sameDayResults.find((item) => !item.session)?.result;
  const baseResult = sameDayResults.find((item) => normalizedResultSession(item.session) && normalizedResultSession(item.session) !== resultSessionSelection)?.result
    || sameDayResults.find((item) => normalizedResultSession(item.session) === resultSessionSelection)?.result
    || sameDayResults.find((item) => !item.session)?.result;
  const preview = market && resultPanelDraft.length === 3
    ? buildMarketResult(market, resultSessionSelection, resultPanelDraft, baseResult)
    : storedResult || "";
  const winners = resultWinners(market, preview, date, resultSessionSelection);
  const resultBids = resultBidsForSession(market, preview, date, resultSessionSelection);
  const resultBidRows = resultBids.length ? `<div class="table-wrap"><table><thead><tr><th>Player</th><th>Mobile</th><th>Game</th><th>Number</th><th>Points</th><th>Outcome</th><th>Win amount</th></tr></thead><tbody>${resultBids.map((entry) => `<tr><td>${escapeHtml(entry.player)}</td><td>${escapeHtml(entry.mobile || "—")}</td><td>${escapeHtml(entry.type)}</td><td><strong>${escapeHtml(entry.number)}</strong></td><td>${money(entry.points)}</td><td>${statusTag(entry.outcome)}</td><td>${entry.outcome === "Winner" ? `<strong>${money(entry.winningAmount)}</strong>` : "—"}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty-state">No bids for this market, date, and session.</div>`;
  const settlementId = market ? `${market.id}|${date}|${resultSessionSelection}` : "";
  const settlement = data.settlements.find((item) => item.id === settlementId);
  const winnerGroups = new Map();
  for (const winner of winners) {
    const group = winnerGroups.get(winner.selection) || [];
    group.push(winner);
    winnerGroups.set(winner.selection, group);
  }
  const groupedWinners = winnerGroups.size ? `<div class="grid two-col">${Array.from(winnerGroups.entries()).map(([number, entries]) => `<section class="panel"><div class="panel-head"><div><h2>Number: ${escapeHtml(number)}</h2><p>${entries.length} winning bid${entries.length === 1 ? "" : "s"}</p></div><strong>${money(entries.reduce((sum, entry) => sum + entry.winningAmount, 0))}</strong></div><div class="table-wrap"><table><thead><tr><th>Mobile</th><th>Name</th><th>Bet</th><th>Win amount</th><th>Action</th></tr></thead><tbody>${entries.map((entry) => `<tr><td>${escapeHtml(entry.mobile || "—")}</td><td>${escapeHtml(entry.player)}</td><td>${money(entry.points)}</td><td><strong>${money(entry.winningAmount)}</strong></td><td>${isEditableBid(entry) ? `<button class="button small" data-action="edit-bid" data-id="${escapeHtml(entry.id)}">Change number</button>` : `<span title="The source bid could not be matched safely.">Not editable</span>`}</td></tr>`).join("")}</tbody></table></div></section>`).join("")}</div>` : `<div class="empty-state">${preview ? "No bids match this market result for the selected date and session." : "Enter a 3-digit panel and publish the result to check winning bids."}</div>`;
  const history = data.markets.flatMap((item) => marketResultsForDate(item, date).map((result) => ({ market: item, ...result })))
    .sort((left, right) => left.market.name.localeCompare(right.market.name) || String(left.session).localeCompare(String(right.session)));
  const resultHistory = history.length ? `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Market</th><th>Session</th><th>Result</th><th></th></tr></thead><tbody>${history.map((item) => `<tr><td>${escapeHtml(item.date)}</td><td>${escapeHtml(item.market.name)}</td><td>${escapeHtml(normalizedResultSession(item.session) || "—")}</td><td><strong>${escapeHtml(item.result)}</strong></td><td><button class="button small" data-action="load-result" data-id="${escapeHtml(item.market.id)}" data-session="${escapeHtml(normalizedResultSession(item.session) || "Open")}" data-date="${escapeHtml(item.date)}" data-result="${escapeHtml(item.result)}">Review / correct</button></td></tr>`).join("")}</tbody></table></div>` : `<div class="empty-state">No results are published for ${escapeHtml(date)}.</div>`;
  return `${pageHeading("Update results", "Select a date to review that day’s results, bids, winners, and losers. New results default to today.", button("Market settings", "go-markets"))}
    <section class="panel"><div class="panel-head"><div><h2>Publish a market result</h2><p>Main markets combine open and close panels; Starline shows one panel and its single digit.</p></div></div>
      ${market ? `<form id="result-form"><div class="form-grid">
        <div class="form-field"><label for="result-market">Market</label><select id="result-market" name="market" class="select" required>${data.markets.map((item) => `<option value="${escapeHtml(item.id)}"${item.id === market.id ? " selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}</select></div>
        <div class="form-field"><label for="result-session">Session</label><select id="result-session" name="session">${["Open", "Close"].map((session) => `<option${resultSessionSelection === session ? " selected" : ""}>${session}</option>`).join("")}</select></div>
        <div class="form-field"><label for="result-date">Result date</label><input id="result-date" name="date" type="date" class="field" value="${escapeHtml(date)}" required></div>
        <div class="form-field"><label for="result-panel">Panel number</label><input id="result-panel" name="panel" class="field" value="${escapeHtml(resultPanelDraft)}" placeholder="Enter 3-digit panel" inputmode="numeric" maxlength="3" pattern="[0-9]{3}" required></div>
        </div><div class="panel" style="margin-top:15px;text-align:center"><small>${escapeHtml(market.name)} · ${escapeHtml(resultSessionSelection)} result</small><div id="result-preview" style="font-size:18px;margin:8px 0">${resultBreakdownMarkup(preview || "### - ## - ###")}</div><p class="hint">Open result uses the Open panel and first Jodi digit; Close result uses the second Jodi digit and Close panel. Single digits are derived from each panel.</p></div>
        <div class="button-row" style="margin-top:18px"><button class="button primary" type="submit">Update result &amp; review bids</button><button class="button" type="button" data-action="clear-result">Clear panel</button></div></form>` : `<div class="empty-state">Add a market before publishing a result.</div>`}
    </section>
    ${market ? `<section class="panel" style="margin-top:16px"><div class="panel-head"><div><h2>Winning bids · ${escapeHtml(market.name)}</h2><p>${escapeHtml(date)} · ${escapeHtml(resultSessionSelection)} · result ${escapeHtml(preview || "not published")}</p></div><div class="button-row">${settlement ? `<span class="status approved">Already distributed · ${money(settlement.total)}</span>` : `<button class="button primary" data-action="distribute-winnings" data-id="${escapeHtml(market.id)}" data-date="${escapeHtml(date)}" data-session="${escapeHtml(resultSessionSelection)}" data-result="${escapeHtml(preview)}" ${winners.length ? "" : "disabled"}>Distribute amount · ${money(winners.reduce((sum, entry) => sum + entry.winningAmount, 0))}</button>`}</div></div>${settlement && settlement.result !== preview ? `<div class="warning-box">A different result was already distributed (${escapeHtml(settlement.result)}). This panel will not pay the same session twice; reconcile any correction through reviewed wallet adjustments.</div>` : ""}${groupedWinners}</section>` : ""}
    ${market ? `<section class="panel" style="margin-top:16px"><div class="panel-head"><div><h2>Bids · winners and losers · ${escapeHtml(market.name)}</h2><p>${escapeHtml(date)} · ${escapeHtml(resultSessionSelection)} · bids stay pending until the required result panels are published.</p></div></div>${resultBidRows}</section>` : ""}
    <section class="panel" style="margin-top:16px"><div class="panel-head"><div><h2>Result history · ${escapeHtml(date)}</h2><p>Only results for the selected date are shown. Choose another date above to review its history.</p></div></div>${resultHistory}</section>`;
}

function ratesPage() {
  return `${pageHeading("Rate chart", "Edit the payout awarded for each ₹10 stake.", button("Reset defaults", "reset-rates"))}
    <section class="panel"><div class="panel-head"><div><h2>Game payout rates</h2></div></div>
    <form id="rates-form"><div class="table-wrap"><table><thead><tr><th>Game type</th><th>Example</th><th>Payout per ₹10</th><th>Equivalent per ₹1</th></tr></thead><tbody>${data.rates.map((rate, index) => `<tr><td><strong>${escapeHtml(rate.id)}</strong></td><td>${["0 – 9", "00 – 99", "124, 234, 368", "112, 577, 336", "111, 222, 444", "Open + close", "Open + close"][index]}</td><td><input class="field" style="max-width:140px" type="number" min="0" step="0.01" name="${escapeHtml(rate.id)}" value="${escapeHtml(rate.value)}" required></td><td>${money(Number(rate.value) / 10)}</td></tr>`).join("")}</tbody></table></div><div class="button-row" style="margin-top:15px"><button class="button primary" type="submit">Save rates</button></div></form></section>`;
}

function transactionTable(rows) {
  return rows.length ? `<div class="table-wrap"><table><thead><tr><th title="Unique record key used to identify this transaction">Transaction ID</th><th>Player</th><th>Last seen</th><th>Type</th><th>Amount</th><th>Date & time</th><th>Details</th></tr></thead><tbody>${rows.map((item) => `<tr><td><strong>${escapeHtml(item.id)}</strong></td><td>${escapeHtml(item.player)}<small style="display:block;color:#9aa3b1;margin-top:3px">${escapeHtml(item.mobile)}</small></td><td>${escapeHtml(lastSeenLabel(item.mobile))}</td><td>${escapeHtml(item.type)}</td><td><strong style="color:${item.amount >= 0 ? "#16866f" : "#475368"}">${item.amountUnavailable ? "—" : `${item.amount > 0 ? "+" : ""}${money(item.amount)}`}</strong></td><td>${escapeHtml(item.date)}</td><td>${escapeHtml(item.note)}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty-state">No matching transactions.</div>`;
}

function transactionsPage() {
  const date = resultDateSelection || localDateKey();
  const dateTransactions = data.transactions.filter((item) => transactionDateKey(item) === date);
  const rows = dateTransactions.filter((item) => `${item.player} ${item.mobile} ${item.id} ${item.type} ${item.note}`.toLowerCase().includes(transactionQuery.toLowerCase()));
  const added = dateTransactions.filter((item) => !item.demo && item.amount > 0).reduce((sum, item) => sum + item.amount, 0);
  const withdrawn = Math.abs(dateTransactions.filter((item) => item.type === "Withdrawal").reduce((sum, item) => sum + item.amount, 0));
  const played = Math.abs(dateTransactions.filter((item) => item.type === "Played").reduce((sum, item) => sum + item.amount, 0));
  return `${pageHeading("Transactions", "Review wallet credits, withdrawals, gameplay, and winnings for the selected date.", button("＋ Record transaction", "manual-payment", "primary"))}
    ${reportDateFilter()}
    <div class="grid three-col" style="margin-bottom:15px"><div class="panel metric-mini"><span>Added · ${escapeHtml(date)}</span><strong>${money(added)}</strong></div><div class="panel metric-mini"><span>Withdrawn · ${escapeHtml(date)}</span><strong>${money(withdrawn)}</strong></div><div class="panel metric-mini"><span>Played · ${escapeHtml(date)}</span><strong>${money(played)}</strong></div></div>
    <section class="panel"><div class="toolbar"><div class="search-wrap"><span class="search-mark">⌕</span><input id="transaction-search" class="field" type="search" placeholder="Search player, reference, or type..." value="${escapeHtml(transactionQuery)}"></div><button class="button" data-action="export">Export data</button></div>${transactionTable(rows)}</section>`;
}

function playedPage() {
  const date = resultDateSelection || localDateKey();
  const playedPlayers = Array.from(new Map(data.bets.map((bet) => {
    const player = data.players.find((item) => item.id === bet.playerId || item.mobile === bet.playerId);
    const id = bet.playerId || bet.mobile || "";
    return [id, { id, name: bet.player || player?.name || id, mobile: bet.mobile || player?.mobile || id }];
  }).filter(([id]) => id)).values()).sort((left, right) => left.name.localeCompare(right.name));
  const marketNames = Array.from(new Set(data.bets.map((bet) => bet.market).filter(Boolean))).sort((left, right) => left.localeCompare(right));
  if (playedMarketFilter !== "All" && !marketNames.includes(playedMarketFilter)) playedMarketFilter = "All";
  if (playedPlayerFilter !== "All" && !playedPlayers.some((player) => player.id === playedPlayerFilter)) {
    playedPlayerFilter = "All";
  }
  const rows = data.bets
    .filter((bet) => {
      if (resultDateForBid(bet) !== date) return false;
      const player = data.players.find((item) => item.id === bet.playerId || item.mobile === bet.playerId);
      const mobile = bet.mobile || player?.mobile || bet.playerId || "";
      const query = playedQuery.trim().toLowerCase();
      const rawDigits = query.replace(/\D/g, "");
      const queryDigits = rawDigits.length === 12 && rawDigits.startsWith("91") ? rawDigits.slice(2) : rawDigits;
      const textMatch = `${bet.player} ${mobile} ${bet.market} ${bet.session} ${bet.type} ${bet.number}`.toLowerCase().includes(query);
      const phoneMatch = queryDigits.length > 0 && String(mobile).replace(/\D/g, "").includes(queryDigits);
      return (playedPlayerFilter === "All" || (bet.playerId || mobile) === playedPlayerFilter)
        && (playedMarketFilter === "All" || bet.market === playedMarketFilter)
        && (!query || textMatch || phoneMatch);
    })
    .slice()
    .sort((left, right) => {
      const leftTime = Date.parse(left.createdAt || left.date);
      const rightTime = Date.parse(right.createdAt || right.date);
      return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
    });
  const table = rows.length ? `<div class="table-wrap"><table><thead><tr><th>Player</th><th>Mobile</th><th>Last seen</th><th>Market</th><th>Session</th><th>Game</th><th>Number</th><th>Points</th><th>Date &amp; time</th><th>Action</th></tr></thead><tbody>${rows.map((bet) => {
    const player = data.players.find((item) => item.id === bet.playerId || item.mobile === bet.playerId);
    const editable = isEditableBid(bet);
    const mobile = bet.mobile || player?.mobile || "";
    return `<tr><td>${escapeHtml(bet.player)}</td><td>${escapeHtml(mobile || "—")}</td><td>${escapeHtml(lastSeenLabel(mobile))}</td><td>${escapeHtml(bet.market)}</td><td>${escapeHtml(bet.session || "—")}</td><td>${escapeHtml(bet.type)}</td><td><strong>${escapeHtml(bet.number)}</strong></td><td>${money(bet.points)}</td><td>${escapeHtml(bet.date)}</td><td>${editable ? `<button class="button small" data-action="edit-bid" data-id="${escapeHtml(bet.id)}">Change number</button>` : `<span title="The legacy bid details could not be matched uniquely.">Not editable</span>`}</td></tr>`;
  }).join("")}</tbody></table></div>` : `<div class="empty-state">No game entries match this search.</div>`;
  const dateBets = data.bets.filter((bet) => resultDateForBid(bet) === date);
  const marketCounts = new Map(marketNames.map((name) => [name, dateBets.filter((bet) => bet.market === name).length]));
  const marketFilters = `<div class="market-history-filters" aria-label="Filter bids by market"><button class="button small ${playedMarketFilter === "All" ? "primary" : ""}" data-action="filter-market" data-market="All" aria-pressed="${playedMarketFilter === "All"}">All markets <span>${dateBets.length}</span></button>${marketNames.map((name) => `<button class="button small ${playedMarketFilter === name ? "primary" : ""}" data-action="filter-market" data-market="${escapeHtml(name)}" aria-pressed="${playedMarketFilter === name}">${escapeHtml(name)} <span>${marketCounts.get(name)}</span></button>`).join("")}</div>`;
  const playersShown = new Set(rows.map((bet) => bet.mobile || bet.playerId).filter(Boolean)).size;
  return `${pageHeading("Bid history & played games", `Bids for ${escapeHtml(date)}. Choose a market, search by player or number, or select another date.`, button("Player list", "go-players"))}${reportDateFilter()}<section class="panel"><div class="panel-head"><div><h2>${playedMarketFilter === "All" ? `All market bids · ${escapeHtml(date)}` : `${escapeHtml(playedMarketFilter)} bids · ${escapeHtml(date)}`}</h2><p>${playersShown} player${playersShown === 1 ? "" : "s"} · ${rows.length} bid${rows.length === 1 ? "" : "s"} shown</p></div></div>${marketFilters}<div class="toolbar"><div class="search-wrap"><span class="search-mark">⌕</span><input id="played-search" class="field" type="search" placeholder="Search player, mobile, market, or number..." value="${escapeHtml(playedQuery)}"></div><select id="played-player-filter" class="select"><option value="All">All players</option>${playedPlayers.map((player) => `<option value="${escapeHtml(player.id)}"${player.id === playedPlayerFilter ? " selected" : ""}>${escapeHtml(player.name)} · ${escapeHtml(player.mobile)}</option>`).join("")}</select></div>${table}</section>`;
}

function allPublishedWinners(dateFilter = "") {
  const winnerMap = new Map();
  for (const market of data.markets) {
    const results = dateFilter ? marketResultsForDate(market, dateFilter) : market.results || [];
    for (const published of results) {
      const session = normalizedResultSession(published.session);
      if (!session || !published.date || !published.result || (dateFilter && published.date !== dateFilter)) continue;
      for (const winner of resultWinners(market, published.result, published.date, session)) {
        const key = `${market.id}|${published.date}|${session}|${winner.id}`;
        if (!winnerMap.has(key)) winnerMap.set(key, { ...winner, market: market.name, date: published.date, session });
      }
    }
  }
  return Array.from(winnerMap.values())
    .sort((left, right) => right.date.localeCompare(left.date)
      || left.market.localeCompare(right.market)
      || left.selection.localeCompare(right.selection));
}

function allSettledBidsForDate(date) {
  const settled = new Map();
  for (const market of data.markets) {
    for (const published of marketResultsForDate(market, date)) {
      const session = normalizedResultSession(published.session);
      if (published.date !== date || !published.result || !session) continue;
      for (const bet of resultBidsForSession(market, published.result, date, session)) {
        if (bet.outcome === "Pending") continue;
        const key = `${session}|${bet.id}`;
        if (!settled.has(key)) {
          settled.set(key, { ...bet, market: market.name, date, session, result: published.result });
        }
      }
    }
  }
  return Array.from(settled.values());
}

function winnersPage() {
  const date = resultDateSelection || localDateKey();
  const winners = allPublishedWinners(date);
  const losers = allSettledBidsForDate(date).filter((bet) => bet.outcome === "Loser");
  const total = winners.reduce((sum, winner) => sum + winner.winningAmount, 0);
  const distributedIds = new Set(data.settlements.flatMap(settlement =>
    (settlement.winners || []).flatMap(player => player.betIds || [])
  ));
  const rows = winners.map(winner => `<tr>
    <td>${escapeHtml(winner.date)}</td>
    <td>${escapeHtml(winner.market)}</td>
    <td>${escapeHtml(winner.session)}</td>
    <td><div class="table-primary"><span class="user-avatar">${escapeHtml(winner.player[0] || "?")}</span><span><strong>${escapeHtml(winner.player)}</strong><small>${escapeHtml(winner.mobile || "—")}</small></span></div></td>
    <td>${escapeHtml(winner.type)}</td>
    <td><strong>${escapeHtml(winner.selection)}</strong></td>
    <td>${money(winner.points)}</td>
    <td><strong>${money(winner.winningAmount)}</strong></td>
    <td>${distributedIds.has(winner.id) ? `<span class="status approved">Distributed</span>` : "Not distributed"}</td>
  </tr>`).join("");
  const loserRows = losers.map((bet) => `<tr>
    <td>${escapeHtml(bet.market)}</td><td>${escapeHtml(bet.session)}</td>
    <td><div class="table-primary"><span class="user-avatar">${escapeHtml(bet.player[0] || "?")}</span><span><strong>${escapeHtml(bet.player)}</strong><small>${escapeHtml(bet.mobile || "—")}</small></span></div></td>
    <td>${escapeHtml(bet.type)}</td><td><strong>${escapeHtml(bet.number)}</strong></td>
    <td>${money(bet.points)}</td><td>${escapeHtml(bet.result)}</td>
  </tr>`).join("");
  const publishedResults = data.markets.reduce((sum, market) => sum + marketResultsForDate(market, date)
    .filter((result) => normalizedResultSession(result.session) && result.result).length, 0);
  return `${pageHeading("Winners & losers", `Settled bids and results for ${escapeHtml(date)}. Change the date to review another day's outcomes.`)}
    ${reportDateFilter()}
    <div class="grid three-col" style="margin-bottom:15px">
      <div class="panel metric-mini"><span>Winning bids · ${escapeHtml(date)}</span><strong>${winners.length}</strong></div>
      <div class="panel metric-mini"><span>Total winning amount</span><strong>${money(total)}</strong></div>
      <div class="panel metric-mini"><span>Losing bids · ${escapeHtml(date)}</span><strong>${losers.length}</strong></div>
      <div class="panel metric-mini"><span>Published results · ${escapeHtml(date)}</span><strong>${publishedResults}</strong></div>
    </div>
    <section class="panel"><div class="panel-head"><div><h2>Winning bid history</h2><p>Only bids matching a published result and a configured rate are included.</p></div><button class="button" data-page="results">Update results</button></div>
      ${rows ? `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Market</th><th>Session</th><th>Player</th><th>Game</th><th>Number</th><th>Bid points</th><th>Winning amount</th><th>Distribution</th></tr></thead><tbody>${rows}</tbody></table></div>` : `<div class="empty-state">No winning bids are available for published results yet.</div>`}
    </section>
    <section class="panel" style="margin-top:15px"><div class="panel-head"><div><h2>Losing bids · ${escapeHtml(date)}</h2><p>Only bids with a published, complete result for their session are marked as losing.</p></div></div>
      ${loserRows ? `<div class="table-wrap"><table><thead><tr><th>Market</th><th>Session</th><th>Player</th><th>Game</th><th>Number</th><th>Points</th><th>Result</th></tr></thead><tbody>${loserRows}</tbody></table></div>` : `<div class="empty-state">No losing bids for ${escapeHtml(date)}.</div>`}
    </section>`;
}

function reportsPage() {
  const date = resultDateSelection || localDateKey();
  const balance = data.players.reduce((sum, player) => sum + Number(player.balance || 0), 0);
  const dateTransactions = data.transactions.filter((item) => transactionDateKey(item) === date);
  const dateBets = data.bets.filter((bet) => resultDateForBid(bet) === date);
  const settledBids = allSettledBidsForDate(date);
  const publishedResults = data.markets.flatMap((market) => marketResultsForDate(market, date)
    .filter((result) => normalizedResultSession(result.session) && result.result)
    .map((result) => ({ market: market.name, ...result })));
  const added = dateTransactions.filter((item) => item.type === "Added").reduce((sum, item) => sum + item.amount, 0);
  const withdrawn = Math.abs(dateTransactions.filter((item) => item.type === "Withdrawal").reduce((sum, item) => sum + item.amount, 0));
  const winningAmount = settledBids.filter((bet) => bet.outcome === "Winner").reduce((sum, bet) => sum + bet.winningAmount, 0);
  return `${pageHeading("Reports", `Wallet, bid, win, and loss activity for ${escapeHtml(date)}.`, button("Export data", "export"))}
    ${reportDateFilter()}
    <div class="grid three-col" style="margin-bottom:15px"><div class="panel metric-mini"><span>Current player balances</span><strong>${money(balance)}</strong></div><div class="panel metric-mini"><span>Points added · ${escapeHtml(date)}</span><strong>${money(added)}</strong></div><div class="panel metric-mini"><span>Points withdrawn · ${escapeHtml(date)}</span><strong>${money(withdrawn)}</strong></div><div class="panel metric-mini"><span>Bid points · ${escapeHtml(date)}</span><strong>${money(dateBets.reduce((sum, bet) => sum + (Number(bet.points) || 0), 0))}</strong></div><div class="panel metric-mini"><span>Winning amount · ${escapeHtml(date)}</span><strong>${money(winningAmount)}</strong></div><div class="panel metric-mini"><span>Winning / losing bids</span><strong>${settledBids.filter((bet) => bet.outcome === "Winner").length} / ${settledBids.filter((bet) => bet.outcome === "Loser").length}</strong></div></div>
    <section class="panel"><div class="panel-head"><div><h2>Published results · ${escapeHtml(date)}</h2><p>Market results recorded on the selected date.</p></div></div>${publishedResults.length ? `<div class="table-wrap"><table><thead><tr><th>Market</th><th>Session</th><th>Result</th></tr></thead><tbody>${publishedResults.map((result) => `<tr><td>${escapeHtml(result.market)}</td><td>${escapeHtml(result.session)}</td><td><strong>${escapeHtml(result.result)}</strong></td></tr>`).join("")}</tbody></table></div>` : `<div class="empty-state">No results are published for ${escapeHtml(date)}.</div>`}</section>
    <section class="panel" style="margin-top:15px"><div class="panel-head"><div><h2>Wallet activity · ${escapeHtml(date)}</h2><p>Transactions recorded on the selected date.</p></div></div>${transactionTable(dateTransactions)}</section>`;
}

function noticesPage() {
  return `${pageHeading("Notices", "Edit the notice shown to players or create an announcement.", button("Send broadcast", "broadcast", "primary"))}
    <section class="panel"><div class="panel-head"><div><h2>Player notice</h2></div></div><form id="notice-form"><div class="form-grid"><div class="form-field full"><label for="notice-title">Title</label><input id="notice-title" class="field" name="title" maxlength="80" value="${escapeHtml(data.settings.noticeTitle)}" required></div><div class="form-field full"><label for="notice-message">Message</label><textarea id="notice-message" class="textarea" name="message" rows="4" maxlength="500" required>${escapeHtml(data.settings.noticeMessage)}</textarea></div></div><div class="button-row" style="margin-top:15px"><button class="button primary" type="submit">Update notice &amp; notify users</button><button class="button" type="button" data-action="broadcast">Compose broadcast</button></div></form></section>
    <section class="panel" style="margin-top:15px"><div class="panel-head"><div><h2>OneSignal server sender</h2><p>Sends go through the authenticated serverless API. Player IDs are read from daily-market-hub <code>All Users/{phone}/push</code> or the primary DATA record.</p></div></div>
      <div class="button-row"><button class="button primary" type="button" data-action="test-broadcast">Test broadcast</button>
      <button class="button" type="button" data-page="push-notify">Compose message</button></div>
    </section>`;
}

function pushNotifyPage() {
  const players = (data.players || []).slice().sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const options = players.map(p => `<option value="${escapeHtml(p.mobile)}">${escapeHtml(p.name)} · ${escapeHtml(p.mobile)}</option>`).join("");
  return `${pageHeading("Push notifications", "Send OneSignal messages securely through the server sender.")}
    <section class="panel">
      <div class="panel-head"><div><h2>Broadcast to all</h2><p>Sends to OneSignal segment <strong>All</strong>.</p></div></div>
      <form id="push-broadcast-form">
        <div class="form-grid">
          <div class="form-field full"><label>Title</label><input class="field" name="title" maxlength="80" value="A2Morning" required></div>
          <div class="form-field full"><label>Message</label><textarea class="textarea" name="message" rows="3" maxlength="400" required placeholder="Write the notification body"></textarea></div>
        </div>
        <div class="button-row" style="margin-top:15px"><button class="button primary" type="submit">Send broadcast</button></div>
      </form>
    </section>
    <section class="panel" style="margin-top:15px">
      <div class="panel-head"><div><h2>Send to one player</h2><p>Uses push id from daily-market-hub / All Users / phone / push.</p></div></div>
      <form id="push-user-form">
        <div class="form-grid">
          <div class="form-field full"><label for="push-player-search">Find player by name or phone</label><input id="push-player-search" class="field" type="search" autocomplete="off" placeholder="Type a name or phone number"></div>
          <div class="form-field full"><label>Player</label><select class="select" name="mobile" required><option value="">Select player</option>${options}</select></div>
          <div class="form-field full"><label>Title</label><input class="field" name="title" maxlength="80" value="A2Morning" required></div>
          <div class="form-field full"><label>Message</label><textarea class="textarea" name="message" rows="3" maxlength="400" required></textarea></div>
        </div>
        <div class="button-row" style="margin-top:15px"><button class="button primary" type="submit">Send to player</button></div>
      </form>
    </section>`;
}

function settingsPage() {
  const settings = data.settings;
  const line = (key, title, description) => `<div class="settings-row"><div><strong>${title}</strong><small>${description}</small></div><input class="toggle" type="checkbox" data-setting="${key}" ${settings[key] ? "checked" : ""}></div>`;
  const globalWebPlayState = globalWebPlayAccessEnabled === null
    ? globalWebPlayAccessError
      ? `<div class="webplay-risk-state unavailable"><strong>STATUS UNAVAILABLE</strong><small>${escapeHtml(globalWebPlayAccessError)}</small></div>`
      : `<div class="webplay-risk-state unavailable"><strong>CHECKING STATUS</strong><small>Reading Admin/WV2 from the a2moring Firebase project.</small></div>`
    : globalWebPlayAccessEnabled
      ? `<div class="webplay-risk-state risky"><strong>RISKY · GLOBAL ACCESS ON</strong><small>Any signed-in app user can open WebPlay, even when their individual WV tag is false.</small></div>`
      : `<div class="webplay-risk-state safe"><strong>NOT RISKY · GLOBAL ACCESS OFF</strong><small>Only individually approved players can open WebPlay.</small></div>`;
  const globalWebPlayAction = globalWebPlayAccessEnabled === null
    ? "Unavailable"
    : globalWebPlayAccessEnabled ? "Disable global access" : "Enable global access";
  const guessingMarkets = uniqueGuessingMarkets();
  const guessingInputs = guessingMarkets.map((market, index) => {
    const guess = adminGuessingMarket(market.name) || defaultAdminGuess(market.name);
    return `<article class="expert-admin-market"><h3>${escapeHtml(market.name)}</h3><div class="form-grid">
      <div class="form-field"><label for="guess-${index}-ank">ANK</label><input id="guess-${index}-ank" class="field" name="guess-${index}-ank" maxlength="80" value="${escapeHtml(displayGuessNumbers(guess.ank))}" placeholder="2 - 0 - 6 - 8"></div>
      <div class="form-field"><label for="guess-${index}-jodi">JODI</label><input id="guess-${index}-jodi" class="field" name="guess-${index}-jodi" maxlength="120" value="${escapeHtml(displayGuessNumbers(guess.jodi))}" placeholder="21 - 29 - 06 - 05"></div>
      <div class="form-field full"><label for="guess-${index}-panna">PANNA</label><input id="guess-${index}-panna" class="field" name="guess-${index}-panna" maxlength="160" value="${escapeHtml(displayGuessNumbers(guess.panna))}" placeholder="255 - 444 - 226 - 145"></div>
    </div></article>`;
  }).join("");
  return `${pageHeading("Game settings", "Manage player website settings, payment methods, maintenance, and game availability.")}
    <section class="panel webplay-global-panel"><div class="panel-head"><div><span class="webplay-special-label">SPECIAL FEATURE</span><h2>Global WebPlay access</h2><p>Controls <code>a2moring/Admin/WV2</code> in the Native App Firebase project.</p></div></div>
      ${globalWebPlayState}
      <button class="button ${globalWebPlayAccessEnabled === null ? "" : globalWebPlayAccessEnabled ? "danger" : "success"} webplay-global-action" data-action="toggle-global-webplay" ${globalWebPlayAccessEnabled === null || globalWebPlayAccessPending ? "disabled" : ""}>${globalWebPlayAccessPending ? "Saving…" : globalWebPlayAction}</button>
    </section>
    <div class="grid overview-grid"><section class="panel"><div class="panel-head"><div><h2>Platform controls</h2><p>Availability settings are synced to the player website.</p></div></div>
      ${line("maintenance", "Maintenance mode", "Show the service as unavailable to players.")}
      ${line("newRegistrations", "New registrations", "Allow new player accounts to be added.")}
      ${line("openBets", "Open session", "Enable the open session for markets.")}
      ${line("closeBets", "Close session", "Enable the close session for markets.")}
    </section><section class="panel"><div class="panel-head"><div><h2>Data & privacy</h2></div></div>
      <div class="settings-row"><div><strong>Data status</strong><small>Changes save automatically</small></div><span class="status active">Live sync</span></div>
      <div class="settings-row"><div><strong>Last saved</strong><small>${new Date(data.updatedAt).toLocaleString()}</small></div></div>
      <div class="button-row" style="margin-top:12px">${button("Export backup", "export")}${button("Import backup", "import-data")}</div>
    </section></div>
    <section class="panel" style="margin-top:15px"><div class="panel-head"><div><h2>Player website configuration</h2></div></div>
      <form id="player-settings-form"><div class="form-grid">
        <div class="form-field"><label for="signup-bonus">Sign-up bonus (points)</label><input id="signup-bonus" class="field" name="signUpBonus" type="number" min="0" step="0.01" value="${escapeHtml(settings.signUpBonus)}" required></div>
        <div class="form-field"><label for="minimum-deposit">Minimum deposit (₹)</label><input id="minimum-deposit" class="field" name="minimumDeposit" type="number" min="0" step="1" value="${escapeHtml(settings.minimumDeposit)}" required><div class="hint">Configured at Admin/Admin/MD and enforced by the player payment options.</div></div>
        <div class="form-field full"><strong>Player payment options</strong><div class="hint">The secure payment gateway takes priority. Direct UPI opens a payment app; deposits remain pending until an administrator verifies them.</div></div>
        <label class="settings-row"><span><strong>Enable UPI QR payments</strong><small>Show the payment QR code and UPI ID to players.</small></span><input class="toggle" type="checkbox" name="qrCodeEnabled" ${settings.qrCodeEnabled ? "checked" : ""}></label>
        <label class="settings-row"><span><strong>Enable direct UPI payments</strong><small>Let players enter an amount and open a UPI app to pay. Admin approval is still required before points are credited.</small></span><input class="toggle" type="checkbox" name="directPaymentEnabled" ${settings.directPaymentEnabled ? "checked" : ""}></label>
        <label class="settings-row"><span><strong>Enable secure payment gateway</strong><small>Use the hosted payment flow when a gateway URL is configured.</small></span><input class="toggle" type="checkbox" name="paymentGatewayEnabled" ${settings.paymentGatewayEnabled ? "checked" : ""}></label>
        <div class="form-field full"><label for="upi-id">UPI ID</label><input id="upi-id" class="field" name="upiId" type="text" maxlength="160" value="${escapeHtml(settings.upiId)}" placeholder="payments@example"></div>
        <div class="form-field full"><label for="upi-url-template">UPI payment link template (Admin Upi)</label><input id="upi-url-template" class="field" name="upiUrlTemplate" type="text" maxlength="1000" value="${escapeHtml(settings.upiUrlTemplate)}" placeholder="upi://pay?pa=payments@example&amp;am=###&amp;cu=INR"><div class="hint">Optional. Use the complete UPI link from Firebase, with ### where the entered payment amount should go. The player app replaces it with the amount before opening the UPI app.</div></div>
        <div class="form-field full"><label for="payment-qr-code">UPI QR code image URL or image data URL</label><textarea id="payment-qr-code" class="textarea" name="qrCode" rows="3" maxlength="500000" placeholder="https://… or data:image/png;base64,…">${escapeHtml(settings.qrCode)}</textarea></div>
        <div class="form-field full"><label for="payment-gateway-url">Secure payment gateway API URL</label><input id="payment-gateway-url" class="field" name="paymentGatewayUrl" type="url" value="${escapeHtml(settings.paymentGatewayUrl)}" placeholder="https://your-site.example/payment-api.php"><div class="hint">Enter the HTTPS URL of your server endpoint. Never enter a gateway API token here; keep it in the private server config outside public_html.</div></div>
        <div class="form-field"><label for="minimum-withdrawal">Minimum withdrawal (₹)</label><input id="minimum-withdrawal" class="field" name="minimumWithdrawal" type="number" min="0" step="1" value="${escapeHtml(settings.minimumWithdrawal)}" required></div>
        <div class="form-field"><label for="minimum-entry">Minimum bid points</label><input id="minimum-entry" class="field" name="minimumEntry" type="number" min="0" step="1" value="${escapeHtml(settings.minimumEntry)}" required><div class="hint">Minimum points for each number; 0 disables the limit.</div></div>
        <div class="form-field"><label for="maximum-entry">Maximum bid points</label><input id="maximum-entry" class="field" name="maximumEntry" type="number" min="0" step="1" value="${escapeHtml(settings.maximumEntry)}" required><div class="hint">Maximum points for each number; 0 disables the limit.</div></div>
        <div class="form-field full"><label for="withdraw-timing">Withdrawal timing message</label><input id="withdraw-timing" class="field" name="withdrawTiming" maxlength="120" value="${escapeHtml(settings.withdrawTiming)}" placeholder="For example: Withdrawals are processed 24/7"></div>
        <div class="form-field full"><strong>Withdrawal request hours</strong><div class="hint">Player requests are accepted only during these two daily windows. Saving creates or updates Admin/Admin/WRTiming.</div></div>
        <div class="form-field"><label for="withdraw-morning-open">Morning open time</label><input id="withdraw-morning-open" class="field" name="morningOpen" type="time" value="${escapeHtml(settings.withdrawalWindows.morning.open)}" required></div>
        <div class="form-field"><label for="withdraw-morning-close">Morning close time</label><input id="withdraw-morning-close" class="field" name="morningClose" type="time" value="${escapeHtml(settings.withdrawalWindows.morning.close)}" required></div>
        <div class="form-field"><label for="withdraw-evening-open">Evening open time</label><input id="withdraw-evening-open" class="field" name="eveningOpen" type="time" value="${escapeHtml(settings.withdrawalWindows.evening.open)}" required></div>
        <div class="form-field"><label for="withdraw-evening-close">Evening close time</label><input id="withdraw-evening-close" class="field" name="eveningClose" type="time" value="${escapeHtml(settings.withdrawalWindows.evening.close)}" required></div>
        <div class="form-field"><label for="player-website-url">Results website URL</label><input id="player-website-url" class="field" name="websiteUrl" type="text" value="${escapeHtml(settings.websiteUrl)}" placeholder="https://example.com"></div>
        <div class="form-field"><label for="matka-60-url">Matka 60 URL</label><input id="matka-60-url" class="field" name="matka60Url" type="url" value="${escapeHtml(settings.matka60Url)}" placeholder="Leave empty to show Coming Soon"></div>
        <div class="form-field"><label for="matka-30-url">Matka 30 URL</label><input id="matka-30-url" class="field" name="matka30Url" type="url" value="${escapeHtml(settings.matka30Url)}" placeholder="Leave empty to show Coming Soon"></div>
        <div class="form-field"><label for="result-chart-url">Market result chart URL</label><input id="result-chart-url" class="field" name="resultChartUrl" type="url" value="${escapeHtml(settings.resultChartUrl)}" placeholder="https://your-domain.example/result.html"></div>
        <div class="form-field"><label for="support-contact-url">WhatsApp support URL</label><input id="support-contact-url" class="field" name="contactUrl" type="text" value="${escapeHtml(settings.contactUrl)}" placeholder="https://wa.me/91..."></div>
        <div class="form-field"><label for="telegram-url">Telegram URL</label><input id="telegram-url" class="field" name="telegramUrl" type="text" value="${escapeHtml(settings.telegramUrl)}" placeholder="https://t.me/..."></div>
        <div class="form-field full"><label for="player-policy">Privacy policy</label><textarea id="player-policy" class="textarea" name="policy" rows="5" maxlength="8000">${escapeHtml(settings.policy)}</textarea></div>
      </div><div class="button-row" style="margin-top:15px"><button class="button primary" type="submit">Save player website settings</button></div></form>
    </section>
    <section class="panel" style="margin-top:15px"><div class="panel-head"><div><h2>Expert guessing numbers</h2><p>Manage the separate web-result Firebase database at ExpertGuessing/&lt;market&gt;. Missing markets are seeded with editable random ANK, JODI, and PANNA values. Players see saved numbers only after tapping to unlock and scratching.</p></div><button class="button primary" type="button" data-action="add-market">＋ Add market</button></div>
      <form id="expert-guessing-form"><div class="expert-admin-grid">${guessingInputs || `<div class="empty-state"><strong>No markets available</strong>Add markets in Markets &amp; games, then return here to publish expert numbers.</div>`}</div><div class="button-row" style="margin-top:15px"><button class="button primary" type="submit" ${guessingMarkets.length ? "" : "disabled"}>Save expert guessing numbers</button></div></form>
    </section>`;
}

function detailsPage() {
  return `${pageHeading("Admin profile", "A2Morning administrator workspace.", button("Back to dashboard", "go-dashboard"))}
    <section class="panel"><div class="table-primary" style="margin-bottom:18px"><span class="user-avatar" style="width:45px;height:45px;font-size:16px">A</span><span><strong>A2Morning Admin</strong><small>Administrator workspace</small></span></div><p style="font-size:12px;color:#778397;line-height:1.7">Sign-in is required to open this panel. Database access should also be restricted to authorized administrators.</p><div class="button-row">${button("Export data backup", "export", "primary")}${button("Import data backup", "import-data")}</div></section>`;
}

function activePlayer() {
  return data.players.find((player) => player.id === selectedPlayerId) || data.players[0];
}

function playerSelect() {
  const player = activePlayer();
  return `<div class="form-field"><label for="portal-player">Preview player</label><select id="portal-player" class="select">${data.players.map((item) => `<option value="${escapeHtml(item.id)}"${item.id === player?.id ? " selected" : ""}>${escapeHtml(item.name)} · ${escapeHtml(item.mobile)}</option>`).join("")}</select></div>`;
}

const gameTypes = [
  ["Single Digit", "0 – 9", "SD.png", /^\d$/],
  ["Jodi Digit", "00 – 99", "DD.png", /^\d{2}$/],
  ["Single Pana", "3 different digits", "SP.png", /^\d{3}$/],
  ["Double Pana", "2 same digits", "DP.png", /^\d{3}$/],
  ["Triple Pana", "3 same digits", "TP.png", /^\d{3}$/],
  ["Half Sangam", "Panel-single (e.g. 124-6)", "HS.png", /^\d{3}-\d$/],
  ["Full Sangam", "Panel-panel (e.g. 124-368)", "FS.png", /^\d{3}-\d{3}$/],
];

function isValidGameNumber(type, number) {
  const rule = gameTypes.find(([label]) => label === type);
  if (!rule || !rule[3].test(number)) return false;
  if (type === "Single Pana") return new Set(number).size === 3;
  if (type === "Double Pana") return new Set(number).size === 2;
  if (type === "Triple Pana") return new Set(number).size === 1;
  return true;
}

function resultComponents(value) {
  const parts = String(value || "").split(/\s*-\s*/).map((part) => part.trim());
  return {
    openPanel: /^\d{3}$/.test(parts[0] || "") ? parts[0] : "",
    jodi: /^\d{2}$/.test(parts[1] || "") ? parts[1] : "",
    closePanel: /^\d{3}$/.test(parts[2] || "") ? parts[2] : "",
  };
}

function normalizedResultSession(value) {
  const session = String(value || "").toLowerCase();
  return session === "open" ? "Open" : session === "close" ? "Close" : "";
}

function marketResultWasReset(market) {
  const rawResult = String(market?.legacyFields?.[6] || "").trim();
  const parts = rawResult.split(/\s*-\s*/).map((part) => part.trim());
  return (parts.length >= 2 && parts.every((part) => /^#+$/.test(part)))
    || (Boolean(market?.resultDate) && market.resultDate !== localDateKey());
}

function marketResultsForDate(market, date) {
  if (date === localDateKey() && (!market || market.resultDate !== date || marketResultWasReset(market))) return [];
  return (market?.results || []).filter((item) => item.date === date);
}

function resultBreakdownMarkup(value) {
  const parts = String(value || "").split(/\s*-\s*/).map((part) => part.trim());
  const openPanel = /^\d{3}$/.test(parts[0] || "") ? parts[0] : "";
  const closePanel = /^\d{3}$/.test(parts[2] || "") ? parts[2] : "";
  const jodi = /^(?:\d{2}|\d#|#\d)$/.test(parts[1] || "") ? parts[1] : "";
  if (!jodi || (!openPanel && !closePanel)) {
    return `<strong>${escapeHtml(value || "—")}</strong>`;
  }
  const openDigit = /^\d/.test(jodi) ? jodi[0] : "#";
  const closeDigit = /\d$/.test(jodi) ? jodi[jodi.length - 1] : "#";
  return `<span class="result-breakdown"><span><small>OPEN</small><strong>${escapeHtml(openPanel || "###")} - ${escapeHtml(openDigit)}</strong></span><span><small>CLOSE</small><strong>${escapeHtml(closeDigit)} - ${escapeHtml(closePanel || "###")}</strong></span></span>`;
}

function panelSingle(panel) {
  return /^\d{3}$/.test(String(panel || ""))
    ? String([...panel].reduce((sum, digit) => sum + Number(digit), 0) % 10)
    : "";
}

function buildMarketResult(market, session, panel, baseResult = "") {
  if (!/^\d{3}$/.test(panel)) return "";
  const existing = resultComponents(baseResult);
  if (market.type === "Starline") return `${panel} - ${panelSingle(panel)}`;
  if (session === "Open") {
    const jodi = existing.closePanel ? `${panelSingle(panel)}${panelSingle(existing.closePanel)}` : `${panelSingle(panel)}#`;
    return `${panel} - ${jodi} - ${existing.closePanel || "###"}`;
  }
  const openPanel = existing.openPanel || "###";
  const jodi = existing.openPanel ? `${panelSingle(openPanel)}${panelSingle(panel)}` : `#${panelSingle(panel)}`;
  return `${openPanel} - ${jodi} - ${panel}`;
}

function resultDateForBid(bet) {
  const raw = String(bet.date || bet.createdAt || "");
  const isoDate = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoDate) return isoDate[1];
  const legacy = raw.match(/^(\d{2})-(\d{2})-(\d{4})/);
  if (legacy) return `${legacy[3]}-${legacy[2]}-${legacy[1]}`;
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? "" : localDateKey(new Date(parsed));
}

function canonicalGameType(value) {
  const type = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, " ");
  if (type === "single" || type === "single digit") return "Single Digit";
  if (type === "jodi" || type === "double digit" || type === "jodi digit" || type === "bulk jodi") return "Jodi Digit";
  if (type === "single pana" || type === "sp motor") return "Single Pana";
  if (type === "double pana" || type === "dp motor") return "Double Pana";
  if (type === "triple pana" || type === "tp motor") return "Triple Pana";
  if (type === "sp dp tp") return "SP DP TP";
  if (type === "half sangam") return "Half Sangam";
  if (type === "full sangam") return "Full Sangam";
  return "";
}

function payoutRateType(gameType, selection) {
  const type = canonicalGameType(gameType);
  if (type !== "SP DP TP") return type;
  if (!/^\d{3}$/.test(selection)) return "";
  const distinctDigits = new Set(selection).size;
  if (distinctDigits === 1) return "Triple Pana";
  if (distinctDigits === 2) return "Double Pana";
  return distinctDigits === 3 ? "Single Pana" : "";
}

function winningSelection(bet, market, result, session) {
  const values = resultComponents(result);
  const type = canonicalGameType(bet.type);
  const selection = String(bet.number || "").trim();
  const betSession = String(bet.session || session).toLowerCase();
  if (type === "Single Digit") {
    const panel = market.type === "Starline" ? values.openPanel : betSession === "close" ? values.closePanel : values.openPanel;
    const single = panelSingle(panel);
    return single && selection === single ? selection : "";
  }
  if (type === "Jodi Digit") {
    const jodi = `${panelSingle(values.openPanel)}${panelSingle(values.closePanel)}`;
    return session === "Close" && values.openPanel && values.closePanel && selection === jodi ? selection : "";
  }
  if (["Single Pana", "Double Pana", "Triple Pana", "SP DP TP"].includes(type)) {
    const panel = market.type === "Starline" ? values.openPanel : betSession === "close" ? values.closePanel : values.openPanel;
    return panel && selection === panel ? selection : "";
  }
  if (type === "Half Sangam" && values.openPanel && values.closePanel) {
    if (session !== "Close") return "";
    const selections = [`${values.openPanel}-${panelSingle(values.closePanel)}`, `${panelSingle(values.openPanel)}-${values.closePanel}`];
    return selections.includes(selection) ? selection : "";
  }
  if (type === "Full Sangam" && values.openPanel && values.closePanel) {
    const jodi = `${panelSingle(values.openPanel)}${panelSingle(values.closePanel)}`;
    return session === "Close" && selection === `${values.openPanel}-${jodi}-${values.closePanel}` ? selection : "";
  }
  return "";
}

function resultIsReadyForBid(bet, market, result) {
  const values = resultComponents(result);
  const type = canonicalGameType(bet.type);
  if (["Jodi Digit", "Half Sangam", "Full Sangam"].includes(type)) {
    return Boolean(values.openPanel && values.closePanel);
  }
  if (["Single Digit", "Single Pana", "Double Pana", "Triple Pana", "SP DP TP"].includes(type)) {
    const panel = market.type === "Starline" || String(bet.session || "").toLowerCase() !== "close"
      ? values.openPanel : values.closePanel;
    return Boolean(panel);
  }
  return false;
}

function resultBidsForSession(market, result, date, session) {
  if (!market || !date || !["Open", "Close"].includes(session)) return [];
  const rates = new Map(data.rates.map((rate) => [canonicalGameType(rate.id) || rate.id, Number(rate.value)]));
  return data.bets.flatMap((bet) => {
    const type = canonicalGameType(bet.type);
    const bidSession = String(bet.session || "Open").toLowerCase();
    const bothPanelsSettleAtClose = ["Jodi Digit", "Half Sangam", "Full Sangam"].includes(type);
    const invalidFullSangamSession = type === "Full Sangam" && bidSession !== "open";
    if (String(bet.market || "").trim().toLowerCase() !== market.name.trim().toLowerCase()
      || resultDateForBid(bet) !== date
      || invalidFullSangamSession
      || (bothPanelsSettleAtClose ? session !== "Close" : bidSession !== session.toLowerCase())) return [];
    const ready = resultIsReadyForBid(bet, market, result);
    const selection = ready ? winningSelection(bet, market, result, session) : "";
    const rate = selection ? rates.get(payoutRateType(bet.type, selection)) : undefined;
    const points = Number(bet.points);
    const player = data.players.find((item) => item.id === bet.playerId || item.mobile === (bet.mobile || bet.playerId));
    if (!Number.isFinite(points) || points <= 0) return [];
    return [{
      ...bet,
      player: player?.name || bet.player || bet.mobile || "Player",
      mobile: player?.mobile || bet.mobile || bet.playerId || "",
      playerId: player?.id || bet.playerId || bet.mobile,
      selection,
      rate,
      outcome: !ready ? "Pending" : selection ? Number.isFinite(rate) ? "Winner" : "Winner · rate unavailable" : "Loser",
      winningAmount: Number.isFinite(rate) ? Math.round((points * rate / 10 + Number.EPSILON) * 100) / 100 : 0,
    }];
  }).sort((left, right) => left.selection.localeCompare(right.selection) || left.player.localeCompare(right.player));
}

function resultWinners(market, result, date, session) {
  return resultBidsForSession(market, result, date, session)
    .filter((bet) => bet.outcome === "Winner");
}

function playerAppPage() {
  const player = activePlayer();
  const slipTotal = betSlip.reduce((sum, entry) => sum + entry.points, 0);
  return `${pageHeading("Place a game", "Player app preview · Add entries to a slip, then submit them to the selected account.", button("My account", "go-player-account"))}
    <div class="grid overview-grid"><section class="panel"><div class="panel-head"><div><h2>New entry</h2><p>Choose a game, market, session, and points.</p></div></div>
      ${playerSelect()}
      <form id="bet-add-form" style="margin-top:12px"><div class="form-grid">
        <div class="form-field"><label for="bet-market">Market</label><select class="select" id="bet-market" name="market" required>${data.markets.map((market) => `<option value="${escapeHtml(market.id)}">${escapeHtml(market.name)} · ${escapeHtml(market.status)}</option>`).join("")}</select></div>
        <div class="form-field"><label for="bet-session">Session</label><select class="select" id="bet-session" name="session"><option>Open</option><option>Close</option></select></div>
        <div class="form-field full"><label for="bet-type">Game type</label><select class="select" id="bet-type" name="type">${gameTypes.map(([name]) => `<option>${name}</option>`).join("")}</select></div>
        <div class="form-field"><label for="bet-number">Number</label><input class="field" id="bet-number" name="number" placeholder="Enter number" required></div>
        <div class="form-field"><label for="bet-points">Points (₹)</label><input class="field" id="bet-points" name="points" type="number" min="1" step="1" placeholder="Enter points" required></div>
      </div><div class="button-row" style="margin-top:13px"><button class="button primary" type="submit">＋ Add to slip</button></div></form>
      <div class="panel-head" style="margin-top:21px"><div><h2>Bet slip <span class="nav-count">${betSlip.length}</span></h2><p>${betSlip.length} entr${betSlip.length === 1 ? "y" : "ies"}</p></div><strong>${money(slipTotal)}</strong></div>
      ${betSlip.length ? `<div class="table-wrap"><table><thead><tr><th>Market</th><th>Session</th><th>Game</th><th>Number</th><th>Points</th><th></th></tr></thead><tbody>${betSlip.map((entry, index) => `<tr><td>${escapeHtml(data.markets.find((item) => item.id === entry.marketId)?.name || "Removed market")}</td><td>${escapeHtml(entry.session)}</td><td>${escapeHtml(entry.type)}</td><td><strong>${escapeHtml(entry.number)}</strong></td><td>${money(entry.points)}</td><td><button class="button small danger" data-action="remove-bet" data-index="${index}">Remove</button></td></tr>`).join("")}</tbody></table></div><div class="button-row" style="justify-content:flex-end;margin-top:13px"><button class="button" data-action="clear-slip">Clear slip</button><button class="button primary" data-action="place-bets">Submit · ${money(slipTotal)}</button></div>` : `<div class="empty-state">Your bet slip is empty. Add a game above to continue.</div>`}
    </section><aside class="panel"><div class="panel-head"><div><h2>Account summary</h2><p>${escapeHtml(player?.name || "No player selected")}</p></div></div><div class="stat-value">${money(player?.balance)}</div><div class="stat-foot">Available wallet balance</div><div class="settings-row" style="margin-top:15px"><div><strong>Market status</strong><small>Open markets accept entries</small></div></div>${marketRows(data.markets.filter((market) => market.status === "Open"))}<div class="button-row" style="margin-top:12px">${button("Deposit / withdraw", "go-player-account")}${button("Game activity", "go-player-history")}</div><p class="stat-foot" style="line-height:1.6;margin-top:14px">Number format: SD 0–9, DD 00–99, pana 3 digits, sangam uses two numbers. Live odds and wager settlement are not connected in this preview.</p></aside></div>`;
}

function playerAccountPage() {
  const player = activePlayer();
  const details = player?.paymentDetails || {};
  return `${pageHeading("Player account", "Player profile, payout details, and wallet requests.", button("Place a game", "go-player-app"))}
    <div class="grid overview-grid"><section class="panel"><div class="panel-head"><div><h2>Profile & payout details</h2><p>${escapeHtml(player?.name || "No player selected")} · ${escapeHtml(player?.mobile || "")}</p></div></div>${playerSelect()}
      <form id="payment-details-form" style="margin-top:14px"><div class="form-grid">
        <div class="form-field full"><label>Account holder name</label><input class="field" name="holder" value="${escapeHtml(details.holder || "")}" placeholder="Account holder name"></div>
        <div class="form-field"><label>IFSC code</label><input class="field" name="ifsc" value="${escapeHtml(details.ifsc || "")}" placeholder="Bank IFSC"></div>
        <div class="form-field"><label>Account number</label><input class="field" name="account" value="${escapeHtml(details.account || "")}" placeholder="Account number"></div>
        <div class="form-field full"><label>UPI / payment number</label><input class="field" name="upi" value="${escapeHtml(details.upi || "")}" placeholder="UPI ID or phone number"></div>
      </div><div class="button-row" style="margin-top:13px"><button class="button primary" type="submit">Save payout details</button></div></form>
      <form id="withdraw-form" style="border-top:1px solid var(--line);margin-top:19px;padding-top:17px"><div class="panel-head"><div><h2>Request a withdrawal</h2><p>Current wallet balance: ${money(player?.balance)}</p></div></div><div class="form-grid"><div class="form-field"><label>Amount (₹)</label><input class="field" name="amount" type="number" min="1" step="1" required></div><div class="form-field"><label>Payment method</label><select class="select" name="method"><option>UPI</option><option>Bank transfer</option><option>Paytm</option><option>Google Pay</option></select></div></div><div class="button-row" style="margin-top:13px"><button class="button primary" type="submit">Send request</button></div></form>
    </section><section class="panel"><div class="panel-head"><div><h2>Account overview</h2><p>Player wallet and account status</p></div></div><div class="stat-value">${money(player?.balance)}</div><div class="stat-foot">Wallet balance</div><div class="settings-row" style="margin-top:15px"><div><strong>Account status</strong><small>Administrator-controlled</small></div>${statusTag(player?.status || "Inactive")}</div><div class="settings-row"><div><strong>Account approval</strong><small>Access to game features</small></div>${statusTag(player?.approved ? "Approved" : "Pending")}</div><div class="settings-row"><div><strong>Last seen</strong><small>${escapeHtml(lastSeenLabel(player?.mobile))}</small></div></div>${data.settings.noticeMessage ? `<div class="panel" style="margin-top:15px;background:#fff9ed"><strong style="font-size:12px">${escapeHtml(data.settings.noticeTitle)}</strong><p style="font-size:11px;color:#756542;line-height:1.6;margin-bottom:0">${escapeHtml(data.settings.noticeMessage)}</p></div>` : ""}</section></div>`;
}

function playerHistoryPage() {
  const date = resultDateSelection || localDateKey();
  const query = playerHistorySearch.trim().toLowerCase();
  const rawDigits = query.replace(/\D/g, "");
  const queryDigits = rawDigits.length === 12 && rawDigits.startsWith("91") ? rawDigits.slice(2) : rawDigits;
  const matchesPlayer = (item) => !query
    || `${item.name} ${item.mobile}`.toLowerCase().includes(query)
    || (queryDigits.length > 0 && String(item.mobile).replace(/\D/g, "").includes(queryDigits));
  const matchingPlayers = data.players.filter(matchesPlayer);
  const player = matchingPlayers.find((item) => item.id === selectedPlayerId) || matchingPlayers[0];
  const selector = `<div class="grid two-col"><div class="form-field"><label for="player-history-search">Search by name or phone</label><input id="player-history-search" class="field" type="search" inputmode="tel" placeholder="Enter player name or phone number" value="${escapeHtml(playerHistorySearch)}"></div><div class="form-field"><label for="portal-player">Select player</label><select id="portal-player" class="select">${matchingPlayers.map((item) => `<option value="${escapeHtml(item.id)}"${item.id === player?.id ? " selected" : ""}>${escapeHtml(item.name)} · ${escapeHtml(item.mobile)}</option>`).join("")}</select></div></div>`;
  if (player) selectedPlayerId = player.id;
  const transactions = data.transactions.filter((item) => item.mobile === player?.mobile && transactionDateKey(item) === date);
  const bets = data.bets.filter((item) => player
    && resultDateForBid(item) === date
    && (item.playerId === player.id || item.playerId === player.mobile || item.mobile === player.mobile))
    .slice()
    .sort((left, right) => {
      const leftTime = Date.parse(left.createdAt || left.date);
      const rightTime = Date.parse(right.createdAt || right.date);
      return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
    });
  return `${pageHeading("My game activity", `Game and wallet history for ${escapeHtml(player?.name || "the selected player")} on ${escapeHtml(date)} · Last seen: ${escapeHtml(lastSeenLabel(player?.mobile))}.`, button("Place a game", "go-player-app"))}${selector}${reportDateFilter()}
    <section class="panel" style="margin-top:15px"><div class="panel-head"><div><h2>Game entries · ${escapeHtml(date)}</h2><p>${bets.length} ${bets.length === 1 ? "entry" : "entries"}</p></div></div>${bets.length ? `<div class="table-wrap"><table><thead><tr><th>Market</th><th>Session</th><th>Game</th><th>Number</th><th>Points</th><th>Date</th></tr></thead><tbody>${bets.map((bet) => `<tr><td>${escapeHtml(bet.market)}</td><td>${escapeHtml(bet.session)}</td><td>${escapeHtml(bet.type)}</td><td><strong>${escapeHtml(bet.number)}</strong></td><td>${money(bet.points)}</td><td>${escapeHtml(bet.date)}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty-state">No game entries for ${escapeHtml(date)}.</div>`}</section>
    <section class="panel" style="margin-top:15px"><div class="panel-head"><div><h2>Wallet history · ${escapeHtml(date)}</h2><p>${transactions.length} transaction${transactions.length === 1 ? "" : "s"}</p></div></div>${transactionTable(transactions)}</section>`;
}

const pageRenderers = {
  dashboard: dashboardPage, players: playersPage, "new-users": newUsersPage,
  "deposit-requests": () => requestKindPage("Deposit"),
  "withdrawal-requests": () => requestKindPage("Withdrawal"),
  requests: () => requestKindPage("Deposit"),
  markets: marketsPage,
  results: resultsPage, winners: winnersPage, rates: ratesPage, transactions: transactionsPage, played: playedPage,
  reports: reportsPage, notices: noticesPage, "push-notify": pushNotifyPage, settings: settingsPage, profile: detailsPage,
  "player-app": playerAppPage, "player-account": playerAccountPage, "player-history": playerHistoryPage,
};

function render(preserveFocusedInput = false) {
  const pageContent = document.getElementById("page-content");
  const activeElement = document.activeElement;
  const focusedInput = preserveFocusedInput
    && pageContent.contains(activeElement)
    && ["INPUT", "SELECT", "TEXTAREA"].includes(activeElement.tagName)
    ? {
      id: activeElement.id,
      name: activeElement.name,
      value: activeElement.value,
      checked: activeElement.checked,
      selectionStart: typeof activeElement.selectionStart === "number" ? activeElement.selectionStart : null,
      selectionEnd: typeof activeElement.selectionEnd === "number" ? activeElement.selectionEnd : null,
    }
    : null;
  updateTopbarTotals();
  setNav();
  document.getElementById("page-crumb").textContent = currentPage === "profile" ? "Admin profile" : currentPage.replace(/^\w/, (char) => char.toUpperCase()).replace("-", " ");
  pageContent.innerHTML = (pageRenderers[currentPage] || dashboardPage)();
  const statusFilter = document.getElementById("player-status-filter");
  if (statusFilter) statusFilter.value = playerStatusFilter;
  const playedFilter = document.getElementById("played-player-filter");
  if (playedFilter) playedFilter.value = playedPlayerFilter;
  if (focusedInput) {
    const replacement = Array.from(pageContent.querySelectorAll("input,select,textarea"))
      .find((element) => focusedInput.id ? element.id === focusedInput.id : element.name === focusedInput.name);
    if (replacement) {
      replacement.value = focusedInput.value;
      if (replacement.type === "checkbox") replacement.checked = focusedInput.checked;
      replacement.focus();
      if (focusedInput.selectionStart !== null && typeof replacement.setSelectionRange === "function") {
        replacement.setSelectionRange(focusedInput.selectionStart, focusedInput.selectionEnd);
      }
    }
  }
}

function goTo(page) {
  currentPage = page;
  if (adminAuthenticated) history.pushState({ adminPage: page }, "", location.href);
  document.getElementById("sidebar").classList.remove("open");
  document.querySelector(".mobile-menu").setAttribute("aria-expanded", "false");
  render();
}

function establishAdminHistory() {
  history.replaceState({ adminPage: "dashboard", adminBackstop: true }, "", location.href);
  history.pushState({ adminPage: "dashboard" }, "", location.href);
}

function modal(title, body, onSubmit, options = {}) {
  const root = document.getElementById("modal-root");
  root.innerHTML = `<div class="modal-backdrop" data-action="close-modal"><section class="modal ${options.wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}"><div class="modal-head"><h2>${escapeHtml(title)}</h2><button class="modal-close" data-action="close-modal" aria-label="Close">×</button></div><form id="modal-form"><div class="modal-body">${body}</div><div class="modal-foot"><button type="button" class="button" data-action="close-modal">Cancel</button><button type="submit" class="button primary">${escapeHtml(options.submitLabel || "Save")}</button></div></form></section></div>`;
  const backdrop = root.querySelector(".modal-backdrop");
  const dialog = root.querySelector(".modal");
  const close = () => { root.innerHTML = ""; };
  dialog.addEventListener("click", (event) => {
    event.stopPropagation();
    const closeButton = event.target.closest('[data-action="close-modal"]');
    if (closeButton && closeButton !== backdrop) close();
    const modalAction = event.target.closest("[data-modal-action]");
    if (modalAction) options.onAction?.(modalAction.dataset.modalAction, dialog);
  });
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) close();
  });
  root.querySelector("#modal-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = event.submitter;
    if (submit) submit.disabled = true;
    try {
      const previousSave = lastPersistPromise;
      const result = await onSubmit(new FormData(event.currentTarget));
      if (result) {
        const saved = lastPersistPromise === previousSave ? true : await lastPersistPromise;
        if (saved) close();
      }
    } catch (error) {
      toast(`Could not save: ${error instanceof Error ? error.message : String(error)}`, true);
    } finally {
      if (submit?.isConnected) submit.disabled = false;
    }
  });
  root.querySelector(".modal-body input:not([type=checkbox]),.modal-body select,.modal-body textarea")?.focus();
}

function playerModal(player) {
  const existing = player || { id: "", name: "", mobile: "", balance: 0, totalAdded: 0, totalWithdrawn: 0, status: "Active", approved: true };
  const isEdit = Boolean(player);
  modal(isEdit ? "Edit player" : "Add player", `<div class="form-grid">
    <div class="form-field"><label>Full name</label><input class="field" name="name" value="${escapeHtml(existing.name)}" required maxlength="80"></div>
    <div class="form-field"><label>Mobile number</label><input class="field" name="mobile" value="${escapeHtml(existing.mobile)}" required inputmode="numeric" pattern="[0-9]{10}" maxlength="10"></div>
    <div class="form-field"><label>Opening balance (₹)</label><input class="field" name="balance" type="number" min="0" step="0.01" value="${existing.balance}" required></div>
    <div class="form-field"><label>Account status</label><select class="select" name="status"><option${existing.status === "Active" ? " selected" : ""}>Active</option><option${existing.status === "Blocked" ? " selected" : ""}>Blocked</option></select></div>
    <div class="form-field full"><label class="check-line"><input name="approved" type="checkbox" ${existing.approved ? "checked" : ""}> Account approved</label></div>
  </div>`, (form) => {
    const name = String(form.get("name")).trim();
    const mobile = String(form.get("mobile")).trim();
    const duplicate = data.players.find((item) => item.mobile === mobile && item.id !== existing.id);
    if (duplicate) return toast("A player with this mobile number already exists.", true), false;
    const record = { ...existing, name, mobile, balance: Number(form.get("balance")), status: form.get("status"), approved: form.has("approved") };
    if (isEdit) Object.assign(player, record);
    else data.players.unshift({ ...record, id: `p-${Date.now()}`, joined: new Date().toLocaleDateString("en-CA"), played: 0, totalAdded: 0, totalWithdrawn: 0 });
    persist(isEdit ? "Player updated." : "Player added.");
    render();
    return true;
  });
}

async function deletePlayerAccount(player) {
  const mobile = String(player?.mobile || "");
  if (!player || !/^\d{10,}$/.test(mobile) || !databaseRootRef || playerDeletionsInProgress.has(mobile)) {
    toast("The player's account or database connection is unavailable.", true);
    return;
  }

  playerDeletionsInProgress.add(mobile);
  try {
    const snapshot = await databaseRootRef.once("value");
    const root = snapshot.val() || {};
    const nextData = normalizeData(root.adminData || data);
    const isPlayerRecord = (record) => String(record?.mobile || "") === mobile
      || String(record?.playerId || "") === mobile;
    nextData.players = nextData.players.filter((item) => !isPlayerRecord(item) && item.id !== mobile);
    nextData.bets = nextData.bets.filter((item) => !isPlayerRecord(item));
    nextData.transactions = nextData.transactions.filter((item) => !isPlayerRecord(item));
    nextData.requests = nextData.requests.filter((item) => !isPlayerRecord(item));
    nextData.settlements = nextData.settlements.map((settlement) => {
      if (!Array.isArray(settlement.winners)) return settlement;
      const winners = settlement.winners.filter((winner) => !isPlayerRecord(winner));
      return {
        ...settlement,
        winners,
        total: winners.reduce((sum, winner) => sum + (Number(winner.amount) || 0), 0),
      };
    });
    nextData.updatedAt = new Date().toISOString();

    const updates = {
      [`DATA/${mobile}`]: null,
      [`Blocked/${mobile}`]: null,
      [`Normal T Data/${mobile}`]: null,
      [`Normal T Data2/${mobile}`]: null,
      "adminData/players": nextData.players,
      "adminData/bets": nextData.bets,
      "adminData/transactions": nextData.transactions,
      "adminData/requests": nextData.requests,
      "adminData/settlements": nextData.settlements,
      "adminData/updatedAt": nextData.updatedAt,
    };

    for (const date of Object.keys(root["New Users"] || {})) {
      if (Object.prototype.hasOwnProperty.call(root["New Users"][date] || {}, mobile)) {
        updates[`New Users/${date}/${mobile}`] = null;
      }
    }

    const requestMatchesPlayer = (key, value) => {
      const decoded = decodeLegacyValue(value);
      const recordMobile = Array.isArray(decoded)
        ? normalizedAdminPhone(decoded[0])
        : normalizedAdminPhone(decoded?.mobile || decoded?.phone);
      return recordMobile === mobile || new RegExp(`(?:^|\\D)${mobile}$`).test(key);
    };
    for (const bucket of ["WR", "DR"]) {
      for (const [key, value] of Object.entries(root[bucket] || {})) {
        if (requestMatchesPlayer(key, value)) updates[`${bucket}/${key}`] = null;
      }
    }

    await databaseRootRef.update(updates);
    data = nextData;
    lastSyncedData = structuredClone(nextData);
    toast(`Deleted ${player.name}'s account and associated database records.`);
    render();
  } catch (error) {
    toast(`Could not delete ${player.name}'s account data: ${error.message}`, true);
  } finally {
    playerDeletionsInProgress.delete(mobile);
  }
}

function editBidModal(bet) {
  if (!bet) return;
  const isLegacyBid = String(bet.id).startsWith("legacy-bid-");
  if (!isEditableBid(bet)) {
    toast("This legacy bid could not be matched to its original AIA details and cannot be changed safely.", true);
    return;
  }
  modal(`Change bid number · ${bet.player}`, `<div class="form-grid">
    <div class="form-field full"><label>Bid details</label><p>${escapeHtml(bet.market)} · ${escapeHtml(bet.session || "—")} · ${escapeHtml(bet.type)} · ${money(bet.points)}</p></div>
    <div class="form-field full"><label for="bid-new-number">New number</label><input id="bid-new-number" class="field" name="number" value="${escapeHtml(bet.number)}" inputmode="numeric" maxlength="7" pattern="[0-9]{1,3}(-[0-9]{1,3})?" required><small class="hint">Only the selected number changes. Points and bid time stay the same.</small></div>
  </div>`, (form) => {
    const number = String(form.get("number") || "").trim();
    if (!/^\d{1,3}(?:-\d{1,3})?$/.test(number)) {
      toast("Enter a number or panel pair using digits, for example 6, 247, or 124-368.", true);
      return false;
    }
    const editableType = bet.type === "Double Digit" ? "Jodi Digit" : bet.type;
    if (gameTypes.some(([type]) => type === editableType) && !isValidGameNumber(editableType, number)) {
      toast(`Enter a number matching ${editableType}.`, true);
      return false;
    }
    if (isLegacyBid) {
      const detailValue = bet.legacyDetailValue.slice();
      if (String(detailValue[2]) !== String(bet.number)) {
        toast("The stored bid has changed since it was loaded. Refresh the admin page before editing it.", true);
        return false;
      }
      const detailTagParts = String(bet.legacyDetailTag || "").split("&");
      if (detailTagParts.length < 4 || detailTagParts[2] !== String(bet.number)) {
        toast("The AIA bid detail key could not be changed safely.", true);
        return false;
      }
      const updatedHistory = String(bet.legacyHistoryValue || "").replace(/:"[^"]*"$/, `:"${number}"`);
      if (updatedHistory === String(bet.legacyHistoryValue || "")) {
        toast("The legacy history record could not be updated safely.", true);
        return false;
      }
      detailTagParts[2] = number;
      detailValue[2] = number;
      const newDetailTag = detailTagParts.join("&");
      bet.legacyDetailPath = `${bet.legacyDetailPath.slice(0, bet.legacyDetailPath.lastIndexOf("/") + 1)}${newDetailTag}`;
      bet.legacyDetailTag = newDetailTag;
      bet.legacyDetailValue = detailValue;
      bet.legacyHistoryValue = updatedHistory;
    }
    bet.number = number;
    persist("Bid number updated in the admin history and player bid records.");
    render();
    return true;
  });
}

function isEditableBid(bet) {
  const legacyBidMatched = !String(bet.id).startsWith("legacy-bid-")
    || Boolean(bet.legacyHistoryPath && bet.legacyDetailPath && Array.isArray(bet.legacyDetailValue) && bet.legacyDetailTag);
  if (!legacyBidMatched) return false;
  return !data.settlements.some((settlement) => String(settlement.market || "").trim().toLowerCase() === String(bet.market || "").trim().toLowerCase()
    && settlement.date === resultDateForBid(bet)
    && (settlement.session === String(bet.session || "Open") || settlement.session === "Close"));
}

function creditModal(player) {
  if (!player) {
    modal("Record payment", `<div class="form-grid"><div class="form-field full"><label for="manual-player-phone">Find player by phone number</label><div class="phone-search"><input class="field" id="manual-player-phone" type="tel" inputmode="numeric" autocomplete="off" placeholder="Enter 10-digit phone number"><button class="button" type="button" data-modal-action="search-player-phone">Search</button></div><p class="hint" id="manual-player-search-feedback" role="status" aria-live="polite"></p></div><div class="form-field full"><label for="manual-player-select">Player</label><select class="select" id="manual-player-select" name="player" required><option value="" selected disabled>Select a player</option>${data.players.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} · ${escapeHtml(item.mobile)}</option>`).join("")}</select></div><div class="form-field"><label>Action</label><select class="select" name="type"><option>Added</option><option>Withdrawal</option></select></div><div class="form-field"><label>Amount (₹)</label><input class="field" name="amount" type="number" min="1" step="0.01" required></div><div class="form-field full"><label>Note</label><input class="field" name="note" maxlength="100" placeholder="Payment details"></div></div>`, (form) => {
      const selected = data.players.find((item) => item.id === form.get("player"));
      if (!selected) return toast("Select a valid player.", true), false;
      const amount = Number(form.get("amount"));
      if (!Number.isFinite(amount) || amount <= 0) return toast("Enter an amount greater than zero.", true), false;
      const type = form.get("type");
      if (type === "Withdrawal" && selected.balance < amount) return toast("The player's balance is too low for this withdrawal.", true), false;
      selected.balance += type === "Added" ? amount : -amount;
      if (type === "Added") selected.totalAdded = Number(selected.totalAdded || 0) + amount;
      else selected.totalWithdrawn = Number(selected.totalWithdrawn || 0) + amount;
      recordManualWalletAdjustment(selected, type, amount, form.get("note"));
      persist("Payment recorded and wallet updated.");
      render();
      return true;
    }, {
      onAction(action, dialog) {
        if (action !== "search-player-phone") return;
        const phoneInput = dialog.querySelector("#manual-player-phone");
        const select = dialog.querySelector("#manual-player-select");
        const feedback = dialog.querySelector("#manual-player-search-feedback");
        const digits = String(phoneInput.value || "").replace(/\D/g, "");
        const normalized = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
        if (!/^\d{10}$/.test(normalized)) {
          select.value = "";
          feedback.textContent = "Enter a valid 10-digit phone number (or a number starting with +91).";
          return;
        }
        const matches = data.players.filter((item) => {
          const storedDigits = String(item.mobile || "").replace(/\D/g, "");
          const storedPhone = storedDigits.length === 12 && storedDigits.startsWith("91") ? storedDigits.slice(2) : storedDigits;
          return storedPhone === normalized;
        });
        if (matches.length !== 1) {
          select.value = "";
          feedback.textContent = matches.length ? "More than one player has this phone number. Select the correct player manually." : "No player found with that phone number.";
          return;
        }
        select.value = matches[0].id;
        feedback.textContent = `Selected ${matches[0].name} · ${matches[0].mobile}.`;
      },
    });
    document.getElementById("manual-player-phone").addEventListener("input", () => {
      document.getElementById("manual-player-select").value = "";
      document.getElementById("manual-player-search-feedback").textContent = "";
    });
    return;
  }
  modal(`Wallet · ${player.name}`, `<div class="form-grid"><div class="form-field full"><label>Current balance</label><strong>${money(player.balance)}</strong></div><div class="form-field"><label>Action</label><select class="select" name="type"><option>Added</option><option>Withdrawal</option></select></div><div class="form-field"><label>Amount (₹)</label><input class="field" name="amount" type="number" min="1" step="0.01" required></div><div class="form-field full"><label>Note</label><input class="field" name="note" placeholder="Admin wallet adjustment" maxlength="100"></div></div>`, (form) => {
    const amount = Number(form.get("amount"));
    const type = form.get("type");
    if (!Number.isFinite(amount) || amount <= 0) return toast("Enter an amount greater than zero.", true), false;
    if (type === "Withdrawal" && player.balance < amount) return toast("The player's balance is too low for this withdrawal.", true), false;
    player.balance += type === "Added" ? amount : -amount;
    if (type === "Added") player.totalAdded = Number(player.totalAdded || 0) + amount;
    else player.totalWithdrawn = Number(player.totalWithdrawn || 0) + amount;
    recordManualWalletAdjustment(player, type, amount, form.get("note"));
    persist("Player wallet updated.");
    render();
    return true;
  });
}

function marketModal(market) {
  const item = market || { name: "", type: "Main market", legacySource: "GAMES", open: "11:00", close: "23:00", status: "Open", result: "—", position: data.markets.length + 1 };
  const initialDays = normalizedMarketDays(item.days, marketDaysForSource(item.legacySource || "GAMES"));
  modal(market ? "Edit market" : "Add market", `<div class="form-grid">
    <div class="form-field"><label>Market name</label><input class="field" name="name" value="${escapeHtml(item.name)}" maxlength="60" required></div>
    <fieldset class="form-field full market-days"><legend>Open on</legend><div class="market-day-options">${MARKET_WEEKDAYS.map(({ name }) => `<label class="market-day-option"><input type="checkbox" name="days" value="${name}"${initialDays.includes(name) ? " checked" : ""}><span>${name.slice(0, 3)}</span></label>`).join("")}</div><div class="hint">Choose every day this market should be available. Select all 7 for a full week.</div></fieldset>
    <div class="form-field"><label>Open time</label><input class="field" name="open" type="time" value="${escapeHtml(marketTimeInput(item.open))}" required></div>
    <div class="form-field"><label>Close time</label><input class="field" name="close" type="time" value="${escapeHtml(marketTimeInput(item.close))}" required></div>
    <div class="form-field"><label>Position</label><input class="field" name="position" type="number" min="0" value="${item.position}" required></div>
    <div class="form-field"><label>Status</label><select class="select" name="status"><option${item.status === "Open" ? " selected" : ""}>Open</option><option${item.status === "Closed" ? " selected" : ""}>Closed</option></select></div>
    </div>`, (form) => {
    const name = String(form.get("name")).trim();
    const days = normalizedMarketDays(form.getAll("days"));
    if (!days.length) return toast("Select at least one day for this market.", true), false;
    const selectedSources = [...new Set(MARKET_WEEKDAYS.filter((day) => days.includes(day.name)).map((day) => day.bucket))];
    const duplicate = data.markets.find((entry) => entry.name.toLowerCase() === name.toLowerCase()
      && entry.id !== item.id
      && normalizedMarketDays(entry.days, marketDaysForSource(entry.legacySource || "GAMES")).some((day) => days.includes(day)));
    if (duplicate) return toast("A market with this name is already scheduled on one or more selected days.", true), false;
    const existingEntries = marketLegacyEntries(item);
    const legacyEntries = {};
    for (const source of selectedSources) {
      legacyEntries[source] = existingEntries[source] || nextLegacyMarketKey(source);
    }
    if (!item.id) {
      item.id = `MARKET-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }
    const primarySource = selectedSources[0];
    Object.assign(item, {
      name,
      type: marketTypeFromName(name),
      days,
      legacyEntries,
      legacySource: primarySource,
      legacyKey: legacyEntries[primarySource],
      open: String(form.get("open") || ""),
      close: String(form.get("close") || ""),
      position: Number(form.get("position")),
      status: form.get("status"),
    });
    if (!Array.isArray(item.legacyFields)) {
      item.legacyFields = [name, legacyMarketTime(item.open), legacyMarketTime(item.close), "Y", "Y", item.status === "Open" ? "Running" : "Stop", "### - ## - ###", String(item.position)];
    } else {
      item.legacyFields = item.legacyFields.slice();
      item.legacyFields[8] = JSON.stringify({ id: item.id, days, resultDate: item.resultDate || "" });
    }
    if (!market) {
      data.markets.push(item);
    }
    persist(market ? "Market updated." : "Market added.");
    render();
    return true;
  });
}

function resultModal(market) {
  resultMarketSelection = market?.id || data.markets[0]?.id || "";
  resultSessionSelection = "Open";
  resultDateSelection = localDateKey();
  resultPanelDraft = "";
  goTo("results");
}

function saveResult(market, session, date, result) {
  if (date === localDateKey() && market.resultDate !== date) {
    market.results = (market.results || []).filter((item) => item.date !== date);
  }
  const previousResult = (market.results || []).find((item) => normalizedResultSession(item.session) === session && item.date === date)?.result;
  const historyItem = { session, date, result, updatedAt: new Date().toISOString() };
  market.results = market.results || [];
  const existingIndex = market.results.findIndex((item) => normalizedResultSession(item.session) === session && item.date === date);
  if (existingIndex >= 0) market.results[existingIndex] = historyItem;
  else market.results.unshift(historyItem);
  if (date === localDateKey()) {
    market[session === "Open" ? "openResult" : "closeResult"] = result;
    market.result = result;
    market.resultDate = date;
    if (Array.isArray(market.legacyFields)) {
      market.legacyFields = market.legacyFields.slice();
      market.legacyFields[6] = result;
      market.legacyFields[8] = JSON.stringify({
        id: market.id,
        days: normalizedMarketDays(market.days),
        resultDate: date,
      });
    }
  }
  market.updatedAt = Date.now();
  data.transactions.unshift({ id: `R-${Date.now()}`, player: "System", mobile: "—", type: "Result", amount: 0, date: new Date().toLocaleString(), note: `${market.name} · ${session} · ${date} · ${result}` });
  return previousResult !== result;
}

async function savePublicResultChart(market, session, date, panel, result) {
  const marketKey = market.name.trim().replace(/[.#$\[\]/]/g, "_");
  const path = ["results", marketKey, date].map(encodeURIComponent).join("/");
  const url = `${resultChartDatabaseUrl}/${path}.json?print=silent`;
  const payload = {
    market: market.name,
    date,
    [session.toLowerCase() === "open" ? "openPanel" : "closePanel"]: panel,
    [session.toLowerCase() === "open" ? "openResult" : "closeResult"]: result,
    updatedAt: new Date().toISOString(),
  };
  const response = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Chart database rejected the result (${response.status}): ${detail || response.statusText}`);
  }
}

function distributeWinnings(market, date, session, result) {
  const settlementId = `${market.id}|${date}|${session}`;
  if (data.settlements.some((item) => item.id === settlementId)) {
    toast("Winnings for this market, date, and session have already been distributed.", true);
    return;
  }
  const published = marketResultsForDate(market, date)
    .find((item) => normalizedResultSession(item.session) === session);
  if (!published || published.result !== result) {
    toast("The displayed result is not the current published result. Refresh and review the result before distributing.", true);
    return;
  }
  const winners = resultWinners(market, result, date, session);
  if (!winners.length) {
    toast("There are no winning bids to distribute for this result.", true);
    return;
  }
  const playersByMobile = new Map(data.players.map((player) => [player.mobile, player]));
  const payoutByPlayer = new Map();
  for (const winner of winners) {
    const player = playersByMobile.get(winner.mobile);
    if (!player || !/^\d{10,}$/.test(player.mobile) || !player.balanceField) {
      toast(`Cannot distribute: the account for ${winner.mobile || winner.player} has no supported balance field.`, true);
      return;
    }
    const payout = payoutByPlayer.get(player.mobile) || { player, amount: 0, wins: [] };
    payout.amount += winner.winningAmount;
    payout.wins.push(winner);
    payoutByPlayer.set(player.mobile, payout);
  }
  for (const { player, amount } of payoutByPlayer.values()) {
    if (!Number.isFinite(player.balance + amount)) {
      toast(`Cannot distribute: invalid balance for ${player.name}.`, true);
      return;
    }
  }
  const totalPayout = Array.from(payoutByPlayer.values()).reduce((sum, item) => sum + item.amount, 0);
  if (!window.confirm(`Distribute ${money(totalPayout)} to ${payoutByPlayer.size} player${payoutByPlayer.size === 1 ? "" : "s"} for ${market.name} · ${session} · ${date}? This session can only be distributed once.`)) return;
  const paidAt = new Date().toISOString();
  const payoutItems = Array.from(payoutByPlayer.values()).map(({ player, amount, wins }) => ({
    mobile: player.mobile,
    player: player.name,
    amount,
    betIds: wins.map((winner) => winner.id),
  }));
  data.settlements.unshift({
    id: settlementId,
    marketId: market.id,
    market: market.name,
    date,
    session,
    result,
    total: totalPayout,
    winners: payoutItems,
    distributedAt: paidAt,
  });
  for (const { player, amount, wins } of payoutByPlayer.values()) {
    player.balance += amount;
    for (const winner of wins) {
      data.transactions.unshift({
        id: `W-${safeMarkerKey(settlementId)}-${safeMarkerKey(winner.id)}`,
        player: player.name,
        mobile: player.mobile,
        type: "Winning",
        amount: winner.winningAmount,
        date: new Date(paidAt).toLocaleString(),
        note: `${market.name} · ${session} · ${winner.type} ${winner.number} · ${date}`,
      });
    }
  }
  const savePromise = persist(`Distributed ${money(totalPayout)} to ${payoutItems.length} player${payoutItems.length === 1 ? "" : "s"}.`);
  render();
  void savePromise.then(async (saved) => {
    if (!saved) return;
    const outcomes = await Promise.all(Array.from(payoutByPlayer.values(), async ({ player, amount }) => {
      try {
        const subscriptionId = await fetchPushIdForPhone(player.mobile);
        if (!subscriptionId) return false;
        // title: total amount win:- {amount} | body: market open/close
        return await sendPushBroadcast(
          `total amount win:- ${money(amount)}`,
          `${market.name} ${session}`,
          { subscriptionId, silent: true }
        );
      } catch (error) {
        console.error(`Could not send winning notification to ${player.mobile}:`, error);
        return false;
      }
    }));
    const sent = outcomes.filter(Boolean).length;
    const notSent = outcomes.length - sent;
    if (notSent) {
      toast(`Winning notifications: ${sent} sent; ${notSent} not sent. Check each winner's DATA/<phone>/push ID and notification subscription.`, true);
    } else {
      toast(`Winning notifications sent to ${sent} winner${sent === 1 ? "" : "s"}.`);
    }
  });
}

function bidExportTimestamp(bet) {
  const candidates = [bet.createdAt, bet.date];
  for (const value of candidates) {
    const raw = String(value || "");
    const iso = Date.parse(raw);
    if (!Number.isNaN(iso)) return new Date(iso);
    const legacyMatch = raw.match(/^(\d{2})-(\d{2})-(\d{4})(?:\s+(.+))?$/);
    if (legacyMatch) {
      const time = legacyMatch[4] || "00:00:00";
      const parsed = new Date(`${legacyMatch[3]}-${legacyMatch[2]}-${legacyMatch[1]}T${time}`);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
  }
  return null;
}

function bidSettlementDetails(bet) {
  const market = data.markets.find((item) => item.name.trim().toLowerCase() === String(bet.market || "").trim().toLowerCase());
  const date = resultDateForBid(bet);
  if (!market || !date) return { outcome: "Pending", result: "", rate: "", winnings: "" };
  const type = canonicalGameType(bet.type);
  const settlingSession = ["Half Sangam", "Full Sangam"].includes(type)
    ? "Close"
    : normalizedResultSession(bet.session) || "Open";
  const published = marketResultsForDate(market, date)
    .find((item) => normalizedResultSession(item.session) === settlingSession);
  if (!published?.result) return { outcome: "Pending", result: "", rate: "", winnings: "" };
  if (!type) return { outcome: "Result posted", result: published.result, rate: "", winnings: "" };
  const selection = winningSelection(bet, market, published.result, settlingSession);
  if (!selection) return { outcome: "Loss", result: published.result, rate: "", winnings: "0" };
  const rateType = payoutRateType(bet.type, selection);
  const rate = Number(data.rates.find((item) => canonicalGameType(item.id) === rateType)?.value);
  if (!Number.isFinite(rate)) return { outcome: "Won · rate unavailable", result: published.result, rate: "", winnings: "" };
  const points = Number(bet.points);
  return { outcome: "Win", result: published.result, rate, winnings: Math.round((points * rate / 10 + Number.EPSILON) * 100) / 100 };
}

function downloadBidExport(range) {
  const now = new Date();
  const start = range === "today"
    ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
    : range === "week" ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6) : null;
  const rows = data.bets
    .map((bet) => ({ bet, timestamp: bidExportTimestamp(bet) }))
    .filter(({ timestamp }) => !start || (timestamp && timestamp >= start && timestamp <= now))
    .sort((left, right) => (right.timestamp?.getTime() || 0) - (left.timestamp?.getTime() || 0));
  if (!rows.length) {
    toast("No bids are available for this export period.", true);
    return false;
  }
  const columns = [
    ["Player", (bet) => bet.player || data.players.find((player) => player.id === bet.playerId || player.mobile === bet.mobile)?.name || ""],
    ["Phone", (bet) => bet.mobile || data.players.find((player) => player.id === bet.playerId)?.mobile || bet.playerId || ""],
    ["Market", (bet) => bet.market],
    ["Session", (bet) => bet.session],
    ["Game", (bet) => bet.type],
    ["Bid number", (bet) => bet.number],
    ["Points", (bet) => bet.points],
    ["Bid time", (bet, timestamp) => timestamp ? timestamp.toLocaleString("en-IN") : bet.date || ""],
    ["Outcome", (bet, timestamp, details) => details.outcome],
    ["Market result", (bet, timestamp, details) => details.result],
    ["Rate", (bet, timestamp, details) => details.rate],
    ["Winning amount", (bet, timestamp, details) => details.winnings],
  ];
  const quote = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = [
    columns.map(([label]) => quote(label)).join(","),
    ...rows.map(({ bet, timestamp }) => {
      const details = bidSettlementDetails(bet);
      return columns.map(([, value]) => quote(value(bet, timestamp, details))).join(",");
    }),
  ].join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  const suffix = range === "today" ? "today" : range === "week" ? "last-7-days" : "all";
  anchor.download = `a2morning-bids-${suffix}-${localDateKey()}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
  toast(`${rows.length} bid${rows.length === 1 ? "" : "s"} exported with player and result details.`);
  return true;
}

function exportData() {
  modal("Export bid history", `<p class="hint">Export only the key bid and player details, including bid time and available win/loss results.</p><div class="export-options">
    <label><input type="radio" name="export-range" value="today" checked><span><strong>Today's bids</strong><small>All bids placed today</small></span></label>
    <label><input type="radio" name="export-range" value="week"><span><strong>Last 7 days</strong><small>Bids placed during the past week</small></span></label>
    <label><input type="radio" name="export-range" value="all"><span><strong>All bid history</strong><small>Every available bid and player record</small></span></label>
  </div>`, (form) => {
    const range = String(form.get("export-range") || "today");
    if (range === "all" && !window.confirm("Export all available bid and player details?")) return false;
    return downloadBidExport(range);
  }, { submitLabel: "Export CSV" });
}

function importData() {
  const picker = document.createElement("input");
  picker.type = "file";
  picker.accept = "application/json,.json";
  picker.addEventListener("change", async () => {
    const file = picker.files?.[0];
    if (!file) return;
    try {
      const imported = JSON.parse(await file.text());
      for (const key of ["players", "markets", "requests", "transactions", "rates"]) {
        if (!Array.isArray(imported[key])) throw new Error(`Backup is missing a valid ${key} list.`);
      }
      if (!imported.settings || typeof imported.settings !== "object") throw new Error("Backup is missing settings.");
      if (!Array.isArray(imported.bets)) imported.bets = [];
      if (!window.confirm("Replace all current data with this backup?")) return;
      data = normalizeData(imported);
      persist("Backup imported.");
      render();
    } catch (error) {
      toast(`Import failed: ${error.message}`, true);
    }
  });
  picker.click();
}

function requestManualPayment() {
  creditModal(null);
}

function publishBroadcast() {
  modal("Compose broadcast", `<div class="form-grid"><div class="form-field full"><label>Broadcast title</label><input class="field" name="title" maxlength="80" value="${escapeHtml(data.settings.noticeTitle)}" required></div><div class="form-field full"><label>Message</label><textarea class="textarea" name="message" rows="4" maxlength="500" required>${escapeHtml(data.settings.noticeMessage)}</textarea><div class="hint">Sends a push notification to all subscribed users through the secure server sender.</div></div></div>`, async (form) => {
    const heading = String(form.get("title") || "").trim();
    const message = String(form.get("message") || "").trim();
    if (!heading || !message) {
      toast("Enter a broadcast title and message.", true);
      return false;
    }
    data.settings.noticeTitle = heading;
    data.settings.noticeMessage = message;
    persist("Broadcast notice saved.");
    const saved = await lastPersistPromise;
    if (!saved) return false;
    render();
    await sendPushBroadcast(heading, message);
    return true;
  }, { submitLabel: "Save & send" });
}

async function requestBroadcast(action, payload = {}) {
  const response = await fetch(BROADCAST_ENDPOINT, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("The notification server returned an invalid response.");
  }
  if (!result || typeof result !== "object") {
    throw new Error("The notification server returned an invalid response.");
  }
  if (!response.ok || result.ok !== true) {
    throw new Error(result.error || `Notification request failed (HTTP ${response.status}).`);
  }
  return result;
}

async function establishBroadcastSession(phone, password) {
  await requestBroadcast("login", { phone, password });
  broadcastSessionEstablished = true;
  return requestBroadcast("status");
}

function closeBroadcastSession() {
  if (!broadcastSessionEstablished) return;
  broadcastSessionEstablished = false;
  void requestBroadcast("logout").catch(error => {
    console.warn(`Could not close the notification session: ${error.message}`);
  });
}

async function sendPushBroadcast(heading, message, { subscriptionId = "", silent = false } = {}) {
  try {
    const result = subscriptionId
      ? await onesignalToPlayerIds([subscriptionId], heading, message)
      : await onesignalBroadcast(heading, message);
    const recipients = Number(result?.recipients) || 0;
    if (!recipients) throw new Error("OneSignal accepted no subscribed recipients. Check the app ID and player subscription.");
    if (!silent) toast(`Push notification sent to ${recipients} recipient(s).`);
    return true;
  } catch (error) {
    if (!silent) toast(`Push notification failed: ${error.message}`, true);
    return false;
  }
}

function requestPath(request) {
  const match = String(request.id).match(/^(WR|DR)-(.+)$/);
  return match ? { collection: match[1], key: match[2] } : null;
}

function safeMarkerKey(value) {
  return String(value).replace(/[^A-Za-z0-9_-]/g, char => `_${char.codePointAt(0).toString(16)}_`);
}

async function adjustRequestBalanceOnce(request, target, operation, delta) {
  if (!databaseRootRef || !target || !/^\d{10,}$/.test(target.mobile)) {
    throw new Error("The player's account could not be found.");
  }
  const marker = safeMarkerKey(`${operation}_${request.id}`);
  const profileRef = databaseRootRef.child(`DATA/${target.mobile}`);
  let alreadyApplied = false;
  const result = await profileRef.transaction(profile => {
    alreadyApplied = false;
    if (!profile || typeof profile !== "object" || Array.isArray(profile)) return;
    const markers = profile.walletRequestAdjustments && typeof profile.walletRequestAdjustments === "object"
      ? profile.walletRequestAdjustments : {};
    if (markers[marker]) {
      alreadyApplied = true;
      return;
    }
    const balanceField = ["bal", "COINS", "B2"].find(field => profile[field] !== undefined && profile[field] !== null);
    if (!balanceField) return;
    const balance = Number(decodeLegacyValue(profile[balanceField]));
    if (!Number.isFinite(balance) || balance < 0) return;
    const nextBalance = balance + delta;
    if (!Number.isFinite(nextBalance) || nextBalance < 0) return;
    const nextMarkers = { ...markers, [marker]: true };
    const nextProfile = { ...profile, [balanceField]: nextBalance, walletRequestAdjustments: nextMarkers };
    const counterField = operation === "deposit" ? "TD" : operation === "withdrawal" ? "TW" : "";
    if (counterField) {
      const currentTotal = Number(decodeLegacyValue(profile[counterField]) || 0);
      if (!Number.isFinite(currentTotal) || currentTotal < 0) return;
      nextProfile[counterField] = currentTotal + request.amount;
    }
    return nextProfile;
  });
  const savedProfile = result.snapshot.val();
  const savedMarkers = savedProfile?.walletRequestAdjustments;
  if (!result.committed && !alreadyApplied && !savedMarkers?.[marker]) {
    throw new Error(delta < 0 ? "The player's balance is insufficient or could not be updated." : "The player's balance could not be updated.");
  }
  if (!savedProfile || typeof savedProfile !== "object") {
    throw new Error("The player's account record is missing.");
  }
  const field = ["bal", "COINS", "B2"].find(name => savedProfile[name] !== undefined && savedProfile[name] !== null);
  if (!field) throw new Error("The player's account has no supported balance field.");
  target.balanceField = field;
  target.balance = Number(decodeLegacyValue(savedProfile[field]));
  target.totalAdded = numberFromLegacy(savedProfile.TD);
  target.totalWithdrawn = numberFromLegacy(savedProfile.TW);
  const baseline = lastSyncedData?.players?.find(player => player.mobile === target.mobile);
  if (baseline) {
    baseline.balanceField = target.balanceField;
    baseline.balance = target.balance;
    baseline.totalAdded = target.totalAdded;
    baseline.totalWithdrawn = target.totalWithdrawn;
  }
  return { alreadyApplied, balance: target.balance, totalAdded: target.totalAdded, totalWithdrawn: target.totalWithdrawn };
}

async function resolvePaymentRequest(requestId, status) {
  const request = data.requests.find(item => item.id === requestId);
  if (!request || request.status !== "Pending" || requestsInProgress.has(requestId)) return;
  const path = requestPath(request);
  if (!path || !databaseRootRef) {
    toast("The request source is not available.", true);
    return;
  }
  if (request.amountUnavailable || !Number.isFinite(request.amount) || request.amount <= 0) {
    toast("This request does not contain a valid amount.", true);
    return;
  }
  const target = data.players.find(player => player.mobile === request.mobile);
  if (status === "Approved" && !target) {
    toast("Cannot approve this request because the player account is missing.", true);
    return;
  }
  if (status === "Cancelled" && request.kind !== "Withdrawal") {
    toast("Only withdrawal requests can be cancelled.", true);
    return;
  }
  if ((status === "Refunded" || (status === "Cancelled" && request.balanceDeducted))
    && (request.kind !== "Withdrawal" || !request.balanceDeducted || !target)) {
    toast("This withdrawal cannot be refunded because its reserved balance is unavailable.", true);
    return;
  }
  if (!["Approved", "Rejected", "Refunded", "Cancelled"].includes(status)) return;

  requestsInProgress.add(requestId);
  render();
  try {
    const requestRef = databaseRootRef.child(`${path.collection}/${path.key}`);
    const snapshot = await requestRef.once("value");
    const currentFields = decodeLegacyValue(snapshot.val());
    if (!Array.isArray(currentFields)) throw new Error("The request no longer exists or has an unsupported format.");
    const amountIndex = request.kind === "Deposit" ? 3 : 7;
    if (String(currentFields[0] || "") !== request.mobile
      || Number(currentFields[amountIndex]) !== request.amount) {
      throw new Error("The request details changed. Refresh the page and review it again.");
    }
    const currentStatus = String(currentFields.at(-1) || "").trim();
    if (currentStatus && currentStatus.toLowerCase() !== "pending") {
      throw new Error(`This request was already marked ${currentStatus}. Refresh the page before continuing.`);
    }
    if (status === "Approved" && request.kind === "Deposit") {
      const outcome = await adjustRequestBalanceOnce(request, target, "deposit", request.amount);
      if (outcome.alreadyApplied) toast("This deposit was already credited; the request status will now be synchronized.");
    } else if (status === "Refunded" || (status === "Cancelled" && request.balanceDeducted)) {
      const outcome = await adjustRequestBalanceOnce(request, target, "refund", request.amount);
      if (outcome.alreadyApplied) {
        toast(status === "Cancelled"
          ? "The reserved balance was already returned; the request status will now be synchronized."
          : "This withdrawal was already refunded; the request status will now be synchronized.");
      }
    } else if (status === "Approved" && request.kind === "Withdrawal" && !request.balanceDeducted) {
      await adjustRequestBalanceOnce(request, target, "withdrawal", -request.amount);
    } else if (status === "Approved" && request.kind === "Withdrawal") {
      await adjustRequestBalanceOnce(request, target, "withdrawal", 0);
    }

    const activeRequest = data.requests.find(item => item.id === requestId) || request;
    const previousStatus = activeRequest.status;
    activeRequest.status = status;
    if (status === "Approved" && request.kind === "Deposit") {
      data.transactions.unshift({
        id: `T-${Date.now()}-${safeMarkerKey(request.id)}`,
        player: target.name,
        mobile: target.mobile,
        type: "Added",
        amount: request.amount,
        date: new Date().toLocaleString(),
        note: `Approved deposit request${currentFields[2] ? ` · UPI reference ${currentFields[2]}` : ""}`,
      });
    } else if (status === "Approved" && request.kind === "Withdrawal") {
      data.transactions.unshift({
        id: `T-${Date.now()}-${safeMarkerKey(request.id)}`,
        player: target.name,
        mobile: target.mobile,
        type: "Withdrawal",
        amount: -request.amount,
        date: new Date().toLocaleString(),
        note: "Approved withdrawal request",
      });
      void notifyUserByPhone(
        target.mobile,
        `Withdawal :- ${money(request.amount)} by A2Morning`,
        `Your withdrawal of ${money(request.amount)} was approved.`
      ).catch(err => console.warn("Withdrawal push failed", err));
    } else if (status === "Refunded" || (status === "Cancelled" && request.balanceDeducted)) {
      data.transactions.unshift({
        id: `T-${Date.now()}-${safeMarkerKey(request.id)}`,
        player: target.name,
        mobile: target.mobile,
        type: "Added",
        amount: request.amount,
        date: new Date().toLocaleString(),
        note: status === "Cancelled" ? "Cancelled withdrawal request; reserved balance returned" : "Refunded reserved withdrawal request",
      });
    }
    persist(`Request ${status.toLowerCase()}.`);
    const saved = await lastPersistPromise;
    if (!saved) {
      activeRequest.status = previousStatus;
      data.transactions = data.transactions.filter(item => !String(item.id).endsWith(safeMarkerKey(request.id)));
      toast("The balance change completed, but request status could not be saved. Retry safely after reconnecting.", true);
    }
  } catch (error) {
    toast(error.message || "Could not resolve the payment request.", true);
  } finally {
    requestsInProgress.delete(requestId);
    render();
  }
}

document.addEventListener("click", (event) => {
  const pageTarget = event.target.closest("[data-page]");
  if (pageTarget) {
    event.preventDefault();
    goTo(pageTarget.dataset.page);
    return;
  }
  const control = event.target.closest("[data-action]");
  if (!control) return;
  const id = control.dataset.id;
  const player = data.players.find((item) => item.id === id);
  const market = data.markets.find((item) => item.id === id);
  switch (control.dataset.action) {
    case "admin-logout": signOutAdmin(); break;
    case "toggle-menu": {
      const sidebar = document.getElementById("sidebar");
      const open = !sidebar.classList.contains("open");
      sidebar.classList.toggle("open", open);
      control.setAttribute("aria-expanded", String(open));
      break;
    }
    case "close-menu":
      document.getElementById("sidebar").classList.remove("open");
      document.querySelector(".mobile-menu").setAttribute("aria-expanded", "false");
      break;
    case "dismiss-notice": control.closest(".notice-strip").remove(); break;
    case "export": exportData(); break;
    case "filter-market":
      playedMarketFilter = control.dataset.market || "All";
      playedPlayerFilter = "All";
      render();
      break;
    case "import-data": importData(); break;
    case "profile": goTo("profile"); break;
    case "go-dashboard": goTo("dashboard"); break;
    case "go-results": goTo("results"); break;
    case "go-markets": goTo("markets"); break;
    case "go-players": goTo("players"); break;
    case "go-player-app": goTo("player-app"); break;
    case "go-player-account": goTo("player-account"); break;
    case "go-player-history": goTo("player-history"); break;
    case "add-player": playerModal(); break;
    case "edit-player": if (player) playerModal(player); break;
    case "player-credit": if (player) creditModal(player); break;
    case "set-player-webplay":
      void setPlayerWebPlayAccess(control.dataset.mobile, control.dataset.enabled === "true");
      break;
    case "toggle-global-webplay":
      if (globalWebPlayAccessEnabled !== null) {
        if (!globalWebPlayAccessEnabled && !window.confirm("Enabling global WebPlay access lets every signed-in app user open WebPlay, even if their individual WV tag is false. Continue?")) break;
        void setGlobalWebPlayAccess(!globalWebPlayAccessEnabled);
      }
      break;
    case "edit-bid": editBidModal(data.bets.find((bet) => bet.id === id)); break;
    case "toggle-player":
      if (player) {
        player.status = player.status === "Blocked" ? "Active" : "Blocked";
        persist(`Player ${player.status.toLowerCase()}.`);
        render();
      }
      break;
    case "delete-player":
      if (player && window.confirm(`Permanently delete ${player.name} (${player.mobile}) and all stored player data, including bids, transactions, payment requests, and signup records? This cannot be undone.`)) {
        void deletePlayerAccount(player);
      }
      break;
    case "resolve-request": {
      const request = data.requests.find((item) => item.id === id);
      if (!request || request.status !== "Pending") break;
      const status = control.dataset.status;
      if (status === "Refunded" && !window.confirm(`Refund ${money(request.amount)} to ${request.player} and close this withdrawal?`)) break;
      if (status === "Cancelled") {
        const refundMessage = request.balanceDeducted ? ` The reserved ${money(request.amount)} will be returned to the player's wallet.` : "";
        if (!window.confirm(`Cancel this withdrawal request for ${request.player}?${refundMessage}`)) break;
      }
      void resolvePaymentRequest(id, status);
      break;
    }
    case "manual-payment": requestManualPayment(); break;
    case "remove-bet":
      betSlip.splice(Number(control.dataset.index), 1);
      render();
      break;
    case "clear-slip":
      betSlip = [];
      render();
      break;
    case "place-bets": {
      const selected = activePlayer();
      const total = betSlip.reduce((sum, entry) => sum + entry.points, 0);
      if (!selected || !betSlip.length) {
        toast("Add at least one entry to the bet slip.", true);
        break;
      }
      if (selected.status !== "Active" || !selected.approved || data.settings.maintenance) {
        toast("This account cannot place games while blocked, unapproved, or in maintenance.", true);
        break;
      }
      if (total > selected.balance) {
        toast("The bet slip total exceeds the player's wallet balance.", true);
        break;
      }
      const invalidEntry = betSlip.some((entry) => {
        const selectedMarket = data.markets.find((item) => item.id === entry.marketId);
        return !selectedMarket || selectedMarket.status !== "Open" || !(entry.session === "Open" ? data.settings.openBets : data.settings.closeBets);
      });

      if (invalidEntry) {
        toast("A market or session in the bet slip is no longer available.", true);
        break;
      }
      for (const entry of betSlip) {
        const selectedMarket = data.markets.find((item) => item.id === entry.marketId);
        data.bets.unshift({ id: `B-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, playerId: selected.id, player: selected.name, mobile: selected.mobile, market: selectedMarket.name, session: entry.session, type: entry.type, number: entry.number, points: entry.points, date: new Date().toLocaleString() });
        data.transactions.unshift({ id: `T-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, player: selected.name, mobile: selected.mobile, type: "Played", amount: -entry.points, date: new Date().toLocaleString(), note: `${selectedMarket.name} · ${entry.session} · ${entry.type} ${entry.number}` });
      }
      selected.balance -= total;
      selected.played = Number(selected.played || 0) + total;
      betSlip = [];
      persist("Game entries submitted and synced.");
      render();
      break;
    }
    case "add-market": marketModal(); break;
    case "edit-market": if (market) marketModal(market); break;
    case "edit-result": resultModal(market); break;
    case "load-result": {
      const selectedMarket = data.markets.find((item) => item.id === id);
      if (selectedMarket) {
        resultMarketSelection = selectedMarket.id;
        resultSessionSelection = normalizedResultSession(control.dataset.session) || "Open";
        resultDateSelection = control.dataset.date || localDateKey();
        const components = resultComponents(control.dataset.result);
        resultPanelDraft = resultSessionSelection === "Close" ? components.closePanel : components.openPanel;
        goTo("results");
      }
      break;
    }
    case "clear-result":
      resultPanelDraft = "";
      render();
      break;
    case "distribute-winnings": {
      const selectedMarket = data.markets.find((item) => item.id === id);
      if (selectedMarket) distributeWinnings(selectedMarket, control.dataset.date, control.dataset.session, control.dataset.result);
      break;
    }
    case "toggle-market":
      if (market) {
        market.status = market.status === "Open" ? "Closed" : "Open";
        persist(`${market.name} is now ${market.status.toLowerCase()}.`);
        render();
      }
      break;
    case "delete-market":
      if (market && window.confirm(`Delete ${market.name}? This cannot be undone.`)) {
        data.markets = data.markets.filter((item) => item.id !== market.id);
        persist("Market deleted.");
        render();
      }
      break;
    case "reset-rates":
      if (window.confirm("Reset payout rates to the default values?")) {
        data.rates = structuredClone(defaultData.rates);
        persist("Rates reset.");
        render();
      }
      break;
    case "broadcast": publishBroadcast(); break;
    case "test-broadcast":
      void onesignalBroadcast("A2Morning", "Test broadcast from admin.")
        .then(result => {
          const recipients = Number(result?.recipients) || 0;
          if (!recipients) throw new Error("OneSignal accepted no subscribed recipients.");
          toast(`Test broadcast sent to ${recipients} recipient(s).`);
        })
        .catch(err => toast(`Test broadcast failed: ${err.message}`, true));
      break;
    case "close-modal": document.getElementById("modal-root").innerHTML = ""; break;
    default: break;
  }
});

document.getElementById("admin-login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (loginInProgress) return;
  const form = new FormData(event.currentTarget);
  const phone = String(form.get("phone") || "").replace(/\D/g, "");
  const password = String(form.get("password") || "");
  const errorElement = document.getElementById("admin-login-error");
  const submitButton = document.getElementById("admin-login-submit");
  if (!/^\d{10}$/.test(phone)) {
    errorElement.textContent = "Enter a valid 10-digit admin phone number.";
    document.getElementById("admin-phone").focus();
    return;
  }
  if (!password.trim()) {
    errorElement.textContent = "Enter your password.";
    document.getElementById("admin-password").focus();
    return;
  }
  loginInProgress = true;
  submitButton.disabled = true;
  submitButton.querySelector("span").textContent = "Verifying…";
  errorElement.textContent = "";
  try {
    const adminCredentials = await verifyAdminLogin(phone, password);
    try {
      const sender = await establishBroadcastSession(phone, password);
      if (!sender.configured) {
        toast("Admin signed in, but the OneSignal REST key is not configured on the server.", true);
      }
    } catch (error) {
      console.warn(`Could not initialize the OneSignal server session: ${error.message}`);
      toast(`Admin signed in, but push notifications are unavailable: ${error.message}`, true);
    }
    localStorage.setItem(ADMIN_SESSION_KEY, "verified");
    localStorage.setItem(ADMIN_CREDENTIAL_FINGERPRINT_KEY, adminCredentials.credentialFingerprint);
    establishAdminHistory();
    setAdminAppVisible(true);
    monitorAdminPassword(adminCredentials.credentialFingerprint);
    document.getElementById("today-date").textContent = new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
    setConnectionStatus("Connecting…", "Live updates", "connecting");
    document.getElementById("page-content").innerHTML = `<div class="panel empty-state">Loading admin data…</div>`;
    startRealtimeSync();
  } catch (error) {
    errorElement.textContent = error instanceof Error ? error.message : "Sign-in failed. Try again.";
  } finally {
    loginInProgress = false;
    submitButton.disabled = false;
    submitButton.querySelector("span").textContent = "Sign in";
  }
});

window.addEventListener("popstate", (event) => {
  if (!adminAuthenticated) return;
  if (event.state?.adminBackstop) {
    history.pushState({ adminPage: currentPage }, "", location.href);
    render();
    return;
  }
  const page = event.state?.adminPage;
  if (page && pageRenderers[page]) {
    currentPage = page;
    render();
    return;
  }
  history.pushState({ adminPage: currentPage }, "", location.href);
  currentPage = "dashboard";
  render();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    document.getElementById("sidebar").classList.remove("open");
    document.querySelector(".mobile-menu").setAttribute("aria-expanded", "false");
  }
});

document.addEventListener("input", (event) => {
  if (event.target.id === "push-player-search") {
    const select = document.querySelector('#push-user-form select[name="mobile"]');
    if (!select) return;
    const search = String(event.target.value || "").trim().toLocaleLowerCase();
    const selectedMobile = select.value;
    const players = (data.players || [])
      .filter(player => `${player.name || ""} ${player.mobile || ""}`.toLocaleLowerCase().includes(search))
      .slice()
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
    select.innerHTML = `<option value="">${players.length ? `Select player (${players.length} found)` : "No players found"}</option>`
      + players.map(player => `<option value="${escapeHtml(player.mobile)}">${escapeHtml(player.name)} · ${escapeHtml(player.mobile)}</option>`).join("");
    if (players.some(player => String(player.mobile) === selectedMobile)) {
      select.value = selectedMobile;
    }
  }
  if (event.target.id === "player-search") {
    playerQuery = event.target.value;
    const selectionStart = event.target.selectionStart;
    render();
    const replacement = document.getElementById("player-search");
    replacement.focus();
    replacement.setSelectionRange(selectionStart, selectionStart);
  }
  if (event.target.id === "transaction-search") {
    transactionQuery = event.target.value;
    const selectionStart = event.target.selectionStart;
    render();
    const replacement = document.getElementById("transaction-search");
    replacement.focus();
    replacement.setSelectionRange(selectionStart, selectionStart);
  }
  if (event.target.id === "request-search") {
    requestQuery = event.target.value;
    const selectionStart = event.target.selectionStart;
    render();
    const replacement = document.getElementById("request-search");
    replacement.focus();
    replacement.setSelectionRange(selectionStart, selectionStart);
  }
  if (event.target.id === "played-search") {
    playedQuery = event.target.value;
    const selectionStart = event.target.selectionStart;
    render();
    const replacement = document.getElementById("played-search");
    replacement.focus();
    replacement.setSelectionRange(selectionStart, selectionStart);
  }
  if (event.target.id === "player-history-search") {
    playerHistorySearch = event.target.value;
    const query = playerHistorySearch.trim().toLowerCase();
    const rawDigits = query.replace(/\D/g, "");
    const queryDigits = rawDigits.length === 12 && rawDigits.startsWith("91") ? rawDigits.slice(2) : rawDigits;
    const match = data.players.find((item) => !query
      || `${item.name} ${item.mobile}`.toLowerCase().includes(query)
      || (queryDigits.length > 0 && String(item.mobile).replace(/\D/g, "").includes(queryDigits)));
    if (match) selectedPlayerId = match.id;
    render(true);
  }
  if (event.target.id === "result-panel") {
    resultPanelDraft = event.target.value.replace(/\D/g, "").slice(0, 3);
    render(true);
  }
});

document.addEventListener("change", (event) => {
  if (event.target.id === "request-date") {
    const date = event.target.value;
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      requestDateSelection = date;
      render();
    }
  }
  if (event.target.id === "activity-date") {
    const date = event.target.value;
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      resultDateSelection = date;
      resultPanelDraft = "";
      render();
    }
  }
  if (event.target.id === "portal-player") {
    selectedPlayerId = event.target.value;
    betSlip = [];
    render();
  }
  if (event.target.id === "bet-type") {
    const type = gameTypes.find(([name]) => name === event.target.value);
    const number = document.getElementById("bet-number");
    if (number && type) number.placeholder = type[1];
  }
  if (event.target.id === "bet-session") {
    const typeSelect = document.getElementById("bet-type");
    const fullSangam = typeSelect && Array.from(typeSelect.options).find((option) => option.value === "Full Sangam");
    if (fullSangam) {
      fullSangam.disabled = event.target.value !== "Open";
      if (fullSangam.disabled && typeSelect.value === "Full Sangam") {
        typeSelect.value = "Single Digit";
        const number = document.getElementById("bet-number");
        if (number) number.placeholder = gameTypes.find(([name]) => name === typeSelect.value)[1];
      }
    }
  }
  if (event.target.id === "player-status-filter") {
    playerStatusFilter = event.target.value;
    render();
  }
  if (event.target.id === "request-filter") {
    requestFilter = event.target.value;
    render();
  }
  if (event.target.id === "result-market") {
    resultMarketSelection = event.target.value;
    resultPanelDraft = "";
    render();
  }
  if (event.target.id === "result-session") {
    resultSessionSelection = event.target.value;
    resultPanelDraft = "";
    render();
  }
  if (event.target.id === "result-date") {
    resultDateSelection = event.target.value;
    resultPanelDraft = "";
    render();
  }
  if (event.target.id === "played-player-filter") {
    playedPlayerFilter = event.target.value;
    render();
  }
  if (event.target.id === "played-market-filter") {
    playedMarketFilter = event.target.value;
    render();
  }
  if (event.target.dataset.setting) {
    data.settings[event.target.dataset.setting] = event.target.checked;
    persist(`${event.target.dataset.setting === "maintenance" ? "Maintenance mode" : "Setting"} ${event.target.checked ? "enabled" : "disabled"}.`);
    render();
  }
});

document.addEventListener("submit", (event) => {
  if (event.target.id === "bet-add-form") {
    event.preventDefault();
    const form = new FormData(event.target);
    const selected = activePlayer();
    const market = data.markets.find((item) => item.id === form.get("market"));
    const type = String(form.get("type"));
    const number = String(form.get("number")).trim();
    const points = Number(form.get("points"));
    const session = String(form.get("session"));
    if (!selected || selected.status !== "Active" || !selected.approved || data.settings.maintenance) {
      toast("This account is not approved to place games.", true);
      return;
    }
    if (!market || market.status !== "Open") {
      toast("Choose a market that is currently open.", true);
      return;
    }
    if (!(session === "Open" ? data.settings.openBets : data.settings.closeBets)) {
      toast(`The ${session.toLowerCase()} session is currently disabled.`, true);
      return;
    }
    if (type === "Full Sangam" && session !== "Open") {
      toast("Full Sangam is available only during the Open session.", true);
      return;
    }
    if (!isValidGameNumber(type, number)) {
      toast("Enter a number matching the selected game type.", true);
      return;
    }
    if (!Number.isInteger(points) || points <= 0) {
      toast("Enter a whole-number points amount greater than zero.", true);
      return;
    }
    const pendingTotal = betSlip.reduce((sum, entry) => sum + entry.points, 0);
    if (pendingTotal + points > selected.balance) {
      toast("The total bet slip cannot exceed the player's wallet balance.", true);
      return;
    }
    betSlip.push({ marketId: market.id, session, type, number, points });
    render();
  }
  if (event.target.id === "payment-details-form") {
    event.preventDefault();
    const selected = activePlayer();
    if (!selected) {
      toast("Choose a player account first.", true);
      return;
    }
    const form = new FormData(event.target);
    selected.paymentDetails = {
      holder: String(form.get("holder") || "").trim(),
      ifsc: String(form.get("ifsc") || "").trim(),
      account: String(form.get("account") || "").trim(),
      upi: String(form.get("upi") || "").trim(),
    };
    persist("Payout details saved.");
    render();
  }
  if (event.target.id === "withdraw-form") {
    event.preventDefault();
    const selected = activePlayer();
    const form = new FormData(event.target);
    const amount = Number(form.get("amount"));
    if (!selected) {
      toast("Choose a player account first.", true);
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0 || amount > selected.balance) {
      toast("Enter an amount within the current wallet balance.", true);
      return;
    }
    data.requests.unshift({ id: `r-${Date.now()}`, player: selected.name, mobile: selected.mobile, kind: "Withdrawal", amount, method: String(form.get("method")), created: new Date().toLocaleString(), status: "Pending" });
    persist("Withdrawal request submitted and synced.");
    render();
  }
  if (event.target.id === "result-form") {
    event.preventDefault();
    const form = new FormData(event.target);
    const market = data.markets.find((item) => item.id === form.get("market"));
    const panel = String(form.get("panel") || "").trim();
    const session = String(form.get("session") || "");
    const date = String(form.get("date") || "");
    if (!market || !["Open", "Close"].includes(session) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{3}$/.test(panel)) {
      toast("Select a valid market, session, date, and 3-digit panel.", true);
      return;
    }
    const otherSession = session === "Open" ? "Close" : "Open";
    const sameDayResults = marketResultsForDate(market, date);
    const baseResult = sameDayResults.find((item) => normalizedResultSession(item.session) === otherSession)?.result
      || sameDayResults.find((item) => normalizedResultSession(item.session) === session)?.result
      || sameDayResults.find((item) => !item.session)?.result;
    const result = buildMarketResult(market, session, panel, baseResult);
    if (!result) {
      toast("The result could not be calculated from this panel.", true);
      return;
    }
    resultMarketSelection = market.id;
    resultSessionSelection = session;
    resultDateSelection = date;
    resultPanelDraft = panel;
    const resultChanged = saveResult(market, session, date, result);
    persist(`Result saved: ${result}. Review the winners before distributing.`);
    void lastPersistPromise.then(async (saved) => {
      if (!saved) return false;
      try {
        await savePublicResultChart(market, session, date, panel, result);
        toast("Public result chart updated.");
      } catch (error) {
        toast(`Result was saved to the admin database, but chart sync failed: ${error.message}`, true);
      }
      if (resultChanged) return sendPushBroadcast(
        `${market.name.toUpperCase()} result updated`,
        `${session}: ${result} · ${date}`
      );
      return false;
    });
    render();
  }
  if (event.target.id === "rates-form") {
    event.preventDefault();
    const form = new FormData(event.target);
    for (const rate of data.rates) {
      const value = Number(form.get(rate.id));
      if (!Number.isFinite(value) || value < 0) {
        toast(`Enter a valid payout for ${rate.id}.`, true);
        return;
      }
      rate.value = value;
    }
    persist("Rate chart updated.");
    render();
  }
  if (event.target.id === "player-settings-form") {
    event.preventDefault();
    const form = new FormData(event.target);
    const signUpBonus = Number(form.get("signUpBonus"));
    const minimumDeposit = Number(form.get("minimumDeposit"));
    const paymentGatewayEnabled = form.get("paymentGatewayEnabled") === "on";
    const paymentGatewayUrl = String(form.get("paymentGatewayUrl") || "").trim();
    const minimumWithdrawal = Number(form.get("minimumWithdrawal"));
    const minimumEntry = Number(form.get("minimumEntry"));
    const maximumEntry = Number(form.get("maximumEntry"));
    const withdrawalWindows = {
      morning: { open: String(form.get("morningOpen") || ""), close: String(form.get("morningClose") || "") },
      evening: { open: String(form.get("eveningOpen") || ""), close: String(form.get("eveningClose") || "") },
    };
    const validTime = value => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
    if (!Number.isFinite(signUpBonus) || signUpBonus < 0 ||
        !Number.isFinite(minimumDeposit) || minimumDeposit < 0 ||
        !Number.isFinite(minimumWithdrawal) || minimumWithdrawal < 0 ||
        !Number.isFinite(minimumEntry) || minimumEntry < 0 ||
        !Number.isFinite(maximumEntry) || maximumEntry < 0 ||
        (maximumEntry > 0 && minimumEntry > maximumEntry) ||
        Object.values(withdrawalWindows).some(window =>
          !validTime(window.open) || !validTime(window.close) || window.open === window.close)) {
      toast("Check the non-negative settings, bid limits, and both withdrawal windows. Each opening time must differ from its closing time.", true);
      return;
    }
    if (paymentGatewayEnabled) {
      let gatewayUrl;
      try {
        gatewayUrl = new URL(paymentGatewayUrl);
      } catch {
        toast("Enter a valid HTTPS payment gateway API URL before enabling gateway payments.", true);
        return;
      }
      if (gatewayUrl.protocol !== "https:") {
        toast("The payment gateway API URL must use HTTPS.", true);
        return;
      }
    }
    const upiUrlTemplate = String(form.get("upiUrlTemplate") || "").trim();
    if (upiUrlTemplate) {
      let paymentUrl;
      try {
        paymentUrl = new URL(upiUrlTemplate.replace(/###/g, "1"));
      } catch {
        toast("Enter a valid upi://pay link for the Admin Upi template.", true);
        return;
      }
      if (paymentUrl.protocol !== "upi:" || paymentUrl.hostname !== "pay" ||
          !paymentUrl.searchParams.get("pa")) {
        toast("The Admin Upi template must be a upi://pay link with a payee ID.", true);
        return;
      }
    }
    Object.assign(data.settings, {
      signUpBonus,
      minimumDeposit,
      qrCodeEnabled: form.get("qrCodeEnabled") === "on",
      directPaymentEnabled: form.get("directPaymentEnabled") === "on",
      paymentGatewayEnabled,
      qrCode: String(form.get("qrCode") || "").trim(),
      upiId: String(form.get("upiId") || "").trim(),
      upiUrlTemplate,
      paymentGatewayUrl,
      minimumWithdrawal,
      minimumEntry,
      maximumEntry,
      withdrawalWindows,
      withdrawalWindowsConfigured: true,
      withdrawTiming: String(form.get("withdrawTiming") || "").trim(),
      websiteUrl: String(form.get("websiteUrl") || "").trim(),
      matka60Url: String(form.get("matka60Url") || "").trim(),
      matka30Url: String(form.get("matka30Url") || "").trim(),
      resultChartUrl: String(form.get("resultChartUrl") || "").trim(),
      contactUrl: String(form.get("contactUrl") || "").trim(),
      telegramUrl: String(form.get("telegramUrl") || "").trim(),
      policy: String(form.get("policy") || "").trim(),
    });
    persist("Player website settings saved.");
    render();
  }
  if (event.target.id === "expert-guessing-form") {
    event.preventDefault();
    const form = new FormData(event.target);
    const submit = event.submitter;
    if (submit) submit.disabled = true;
    void saveAdminExpertGuessing(form).then(() => {
      generatedExpertGuessing.clear();
      toast("Expert guessing numbers saved to the web-result Firebase database.");
      render();
    }).catch(error => {
      toast(error.message || "Expert guessing numbers could not be saved.", true);
    }).finally(() => {
      if (submit) submit.disabled = false;
    });
  }
  if (event.target.id === "push-broadcast-form") {
    event.preventDefault();
    const form = new FormData(event.target);
    const title = String(form.get("title") || "").trim();
    const message = String(form.get("message") || "").trim();
    if (!title || !message) return toast("Enter title and message.", true);
    void onesignalBroadcast(title, message)
      .then(() => toast("Broadcast sent."))
      .catch(err => toast(`Broadcast failed: ${err.message}`, true));
    return;
  }
  if (event.target.id === "push-user-form") {
    event.preventDefault();
    const form = new FormData(event.target);
    const mobile = String(form.get("mobile") || "").trim();
    const title = String(form.get("title") || "").trim();
    const message = String(form.get("message") || "").trim();
    if (!mobile || !title || !message) return toast("Select a player and enter title and message.", true);
    void notifyUserByPhone(mobile, title, message)
      .then(res => {
        if (res?.skipped) toast("No push id for this player on daily-market-hub.", true);
        else toast("Notification sent to player.");
      })
      .catch(err => toast(`Send failed: ${err.message}`, true));
    return;
  }
  if (event.target.id === "notice-form") {
    event.preventDefault();
    const form = new FormData(event.target);
    const noticeTitle = String(form.get("title") || "").trim();
    const noticeMessage = String(form.get("message") || "").trim();
    if (!noticeTitle || !noticeMessage) {
      toast("Enter a notice title and message.", true);
      return;
    }
    data.settings.noticeTitle = noticeTitle;
    data.settings.noticeMessage = noticeMessage;
    persist("Player notice saved.");
    void lastPersistPromise.then((saved) => {
      if (saved) return sendPushBroadcast(noticeTitle, noticeMessage);
      return false;
    });
    render();
  }
});

function startRealtimeSync() {
  if (!adminAuthenticated) return;
  if (typeof firebase === "undefined") {
    setConnectionStatus("Connection unavailable", "Check your internet connection", "error");
    document.getElementById("page-content").innerHTML = `<div class="panel empty-state">Could not connect. Check your internet connection and reload this page.</div>`;
    return;
  }

  try {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    databaseRootRef = firebase.database().ref();
    databaseRef = databaseRootRef.child("adminData");
    try {
      watchGlobalWebPlayAccess();
    } catch (error) {
      globalWebPlayAccessEnabled = null;
      globalWebPlayAccessError = error.message || "Could not connect to a2moring.";
      toast(`Could not monitor global WebPlay access: ${globalWebPlayAccessError}`, true);
    }
    let initializingDatabase = false;
    databaseRootRef.on("value", (snapshot) => {
      const root = snapshot.val() || {};
      if (!root.adminData) {
        if (initializingDatabase) return;
        initializingDatabase = true;
        databaseRef.transaction((current) => current === null ? createEmptyData() : undefined)
          .then(() => { initializingDatabase = false; })
          .catch((error) => {
            initializingDatabase = false;
            setConnectionStatus("Database error", "Could not initialize /adminData", "error");
            toast(`Could not initialize admin data: ${error.message}`, true);
          });
        return;
      }

      legacyMarketKeys = new Map(["GAMES", "GAMES2", "GAMES3"].map((source) => [
        source,
        new Set(Object.keys(root[source] || {})),
      ]));
      data = mergeLiveData(root);
      ensureDefaultWithdrawalWindows(root);
      if (!adminExpertGuessingLoaded && !adminExpertGuessingLoadInProgress) {
        adminExpertGuessingLoadInProgress = true;
        void fetchAdminExpertGuessing().then(() => {
          adminExpertGuessingLoaded = true;
          return seedMissingAdminExpertGuessing();
        }).then(() => {
          if (currentPage === "settings") render();
        }).catch(error => {
          toast(error.message || "Could not load or seed expert guessing numbers.", true);
        }).finally(() => {
          adminExpertGuessingLoadInProgress = false;
        });
      } else if (adminExpertGuessingLoaded) {
        void seedMissingAdminExpertGuessing().catch(error => {
          toast(error.message || "Could not seed expert guessing numbers.", true);
        });
      }
      todayNewUsers = readTodayNewUsers(root);
      todayLoginCount = todayNewUsers.length;
      gameAccessByMobile = readGameAccessByMobile(root);
      lastSeenByMobile = readLastSeenByMobile(root);
      lastSyncedData = structuredClone(data);
      if (!data.players.some((player) => player.id === selectedPlayerId)) {
        selectedPlayerId = data.players[0]?.id || "";
      }
      setConnectionStatus("Connected", `Updated ${new Date().toLocaleTimeString()}`, "online");
      render(true);
    }, (error) => {
      setConnectionStatus("Connection error", "Check connection and access", "error");
      document.getElementById("page-content").innerHTML = `<div class="panel empty-state">Could not load admin data.<br><small>${escapeHtml(error.message)}</small></div>`;
      toast(`Could not load admin data: ${error.message}`, true);
    });
  } catch (error) {
    setConnectionStatus("Connection error", "Could not start live updates", "error");
    document.getElementById("page-content").innerHTML = `<div class="panel empty-state">Could not connect to admin data.<br><small>${escapeHtml(error.message)}</small></div>`;
    toast(`Could not connect: ${error.message}`, true);
  }
}

if (localStorage.getItem(ADMIN_SESSION_KEY) === "verified") {
  const savedFingerprint = localStorage.getItem(ADMIN_CREDENTIAL_FINGERPRINT_KEY) || "";
  if (!savedFingerprint) {
    signOutAdmin();
  } else {
    void (async () => {
      try {
        if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
        const snapshot = await firebase.database().ref("Admin/Admin/PassAdmin").once("value");
        const currentFingerprint = await adminPasswordFingerprint(snapshot.val());
        if (currentFingerprint !== savedFingerprint) {
          signOutAdmin("The admin password changed. Sign in again with the new password.");
          return;
        }
        setAdminAppVisible(true);
        monitorAdminPassword(savedFingerprint);
        document.getElementById("today-date").textContent = new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
        setConnectionStatus("Connecting…", "Live updates", "connecting");
        document.getElementById("page-content").innerHTML = `<div class="panel empty-state">Loading admin data…</div>`;
        establishAdminHistory();
        startRealtimeSync();
      } catch (error) {
        signOutAdmin(`Could not verify your saved admin session: ${error.message}`);
      }
    })();
  }
} else {
  setAdminAppVisible(false);
}

window.addEventListener("storage", (event) => {
  if (event.key === ADMIN_SESSION_KEY && !event.newValue && adminAuthenticated) {
    signOutAdmin("Signed out in another browser tab.");
  }
});
