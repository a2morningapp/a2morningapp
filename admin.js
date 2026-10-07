const firebaseConfig = {
  apiKey: "AIzaSyB8nW1wxOLhTYBj1-6k-q-jmms50GUUxGg",
  authDomain: "a2moring.firebaseapp.com",
  databaseURL: "https://a2moring-default-rtdb.firebaseio.com",
  projectId: "a2moring",
  storageBucket: "a2moring.firebasestorage.app",
  messagingSenderId: "528466835850",
  appId: "1:528466835850:web:ee5cfc804c2bdaf71fb073",
  measurementId: "G-2HVR18MNEZ",
};

const navigation = [
  { section: "OVERVIEW" },
  { id: "dashboard", label: "Dashboard", icon: "⌂" },
  { id: "new-users", label: "New users", icon: "✦" },
  { section: "OPERATIONS" },
  { id: "players", label: "Players", icon: "♙" },
  { id: "requests", label: "Payment requests", icon: "⇄", count: "pending" },
  { id: "markets", label: "Markets & games", icon: "◈" },
  { id: "results", label: "Update results", icon: "✓" },
  { id: "rates", label: "Rate chart", icon: "▤" },
  { section: "INSIGHTS & TOOLS" },
  { id: "transactions", label: "Transactions", icon: "↕" },
  { id: "played", label: "Bid history & played games", icon: "▦" },
  { id: "reports", label: "Reports", icon: "▥" },
  { id: "notices", label: "Notices", icon: "◉" },
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
    { id: "Single Digit", value: 9.5 },
    { id: "Jodi Digit", value: 95 },
    { id: "Single Pana", value: 150 },
    { id: "Double Pana", value: 300 },
    { id: "Triple Pana", value: 700 },
    { id: "Half Sangam", value: 1000 },
    { id: "Full Sangam", value: 10000 },
  ],
  bets: [],
  settlements: [],
  settings: {
    maintenance: false,
    newRegistrations: true,
    openBets: true,
    closeBets: true,
    signUpBonus: 0,
    minimumWithdrawal: 0,
    policy: "",
    websiteUrl: "",
    contactUrl: "",
    telegramUrl: "",
    resultChartUrl: "",
    noticeTitle: "Welcome to Kalyan Gold",
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
    ...data.markets
      .filter((market) => market.legacySource === source)
      .map((market) => String(market.legacyKey)),
  ]);
  let key = 1;
  while (usedKeys.has(String(key))) key += 1;
  return String(key);
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
    return { amount, amountUnavailable: amount === null, method: "Legacy record", details: "", balanceDeducted: false };
  }

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
      ].filter(Boolean).join(" · "),
      balanceDeducted: false,
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
      played: numberFromLegacy(player.TW ?? player.TD),
      balanceField: Object.prototype.hasOwnProperty.call(player, "bal") ? "bal"
        : Object.prototype.hasOwnProperty.call(player, "COINS") ? "COINS"
          : Object.prototype.hasOwnProperty.call(player, "B2") ? "B2" : "",
      status: Object.prototype.hasOwnProperty.call(blocked, mobile) ? "Blocked" : "Active",
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
      const marketIdentity = `${source}:${name.toLowerCase()}`;
      if (!marketMap.has(marketIdentity)) {
        marketMap.set(marketIdentity, {
          id: `${source}-${id}`,
          name,
          type: marketTypeFromName(name),
          open: String(fields[1] || ""),
          close: String(fields[2] || ""),
          status: /close|stop|off/i.test(statusValue) ? "Closed" : "Open",
          result: "—",
          position: numberFromLegacy(fields[7] || id),
          legacySource: source,
          legacyKey: id,
          legacyFields: fields,
        });
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
        amount: Number.isFinite(request.amount) ? request.amount : 0,
        created: id.replace(/\s+\d{10,}$/, ""),
        status: "Pending",
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
    legacy.settings.minimumWithdrawal = numberFromLegacy(adminSettings.MW);
    const policy = decodeLegacyValue(adminSettings.Policy);
    legacy.settings.policy = Array.isArray(policy) ? policy.join("\n\n") : String(policy || "");
    legacy.settings.websiteUrl = String(decodeLegacyValue(adminSettings.Website) || "");
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

function dateKeyToIso(value) {
  const date = String(value || "");
  const legacyMatch = date.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (legacyMatch) return `${legacyMatch[3]}-${legacyMatch[2]}-${legacyMatch[1]}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "";
}

function readLastSeenByMobile(root) {
  const lastSeen = new Map();
  const update = (mobile, value, exact = false) => {
    if (!/^\d{10,}$/.test(String(mobile || "")) || value === null || value === undefined || value === "") return;
    const timestamp = String(value);
    const dateOnly = dateKeyToIso(timestamp);
    const normalized = dateOnly || timestamp;
    const current = lastSeen.get(mobile);
    if (!current || (exact && !current.exact) || (exact === current.exact && normalized > current.value)) {
      lastSeen.set(mobile, { value: normalized, exact });
    }
  };
  const profileRoot = root.DATA && typeof root.DATA === "object" ? root.DATA : {};
  for (const [mobile, profile] of Object.entries(profileRoot)) {
    if (!profile || typeof profile !== "object") continue;
    const value = profile.lastSeen ?? profile.lastLogin ?? profile.last_seen ?? profile.LastSeen ?? profile.LastLogin ?? profile["Last Seen"];
    if (value !== undefined) update(mobile, decodeLegacyValue(value), true);
  }

  const explicit = root["Last Seen"] || root.LastSeen;
  if (explicit && typeof explicit === "object") {
    for (const [mobile, rawValue] of Object.entries(explicit)) {
      const value = decodeLegacyValue(rawValue);
      const timestamp = value && typeof value === "object"
        ? value.lastSeen ?? value.lastLogin ?? value.timestamp ?? value.time
        : value;
      update(mobile, timestamp, true);
    }
  }

  const usersByDate = root["New Users"];
  if (usersByDate && typeof usersByDate === "object" && !Array.isArray(usersByDate)) {
    for (const [dateKey, users] of Object.entries(usersByDate)) {
      const isoDate = dateKeyToIso(dateKey);
      if (!isoDate || !users || typeof users !== "object" || Array.isArray(users)) continue;
      for (const [tag, rawValue] of Object.entries(users)) {
        if (tag === "x" || rawValue === null || rawValue === undefined) continue;
        const value = decodeLegacyValue(rawValue);
        const candidates = [tag];
        const collect = (item) => {
          if (typeof item === "string" || typeof item === "number") candidates.push(String(item));
          else if (Array.isArray(item)) item.forEach(collect);
          else if (item && typeof item === "object") Object.values(item).forEach(collect);
        };
        collect(value);
        const mobiles = new Set(candidates.map((item) => item.replace(/\D/g, "")).filter((item) => /^\d{10,}$/.test(item)));
        for (const mobile of mobiles) update(mobile, isoDate);
      }
    }
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
  merged.players = mergeRecords(legacy.players, Array.isArray(adminData.players) ? adminData.players : []);
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
let databaseRef;
let databaseRootRef;
let adminAuthenticated = false;
let loginInProgress = false;
let currentPage = "dashboard";
let requestFilter = "All";
let playerQuery = "";
let playerStatusFilter = "All";
let transactionQuery = "";
let requestQuery = "";
let playedQuery = "";
let playedPlayerFilter = "All";
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
}

function setAdminAppVisible(visible) {
  adminAuthenticated = visible;
  document.getElementById("admin-login").hidden = visible;
  document.getElementById("admin-app").hidden = !visible;
}

function signOutAdmin() {
  if (databaseRootRef) databaseRootRef.off();
  databaseRef = undefined;
  databaseRootRef = undefined;
  lastSyncedData = null;
  data = createEmptyData();
  todayLoginCount = 0;
  todayNewUsers = [];
  gameAccessByMobile = new Set();
  lastSeenByMobile = new Map();
  currentPage = "dashboard";
  document.getElementById("sidebar").classList.remove("open");
  document.querySelector(".mobile-menu").setAttribute("aria-expanded", "false");
  document.getElementById("modal-root").innerHTML = "";
  document.getElementById("toast-root").innerHTML = "";
  setAdminAppVisible(false);
  document.getElementById("admin-login-form").reset();
  document.getElementById("admin-login-error").textContent = "";
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
    ["minimumWithdrawal", "MW"],
    ["policy", "Policy"],
    ["websiteUrl", "Website"],
    ["contactUrl", "Contact"],
    ["telegramUrl", "Telegram"],
    ["resultChartUrl", "Market_Reult_chart_Web"],
  ];
  for (const [property, key] of playerSettings) {
    if (changed.settings && changed.settings[property] !== oldSettings[property]) {
      updates[`Admin/Admin/${key}`] = String(changed.settings[property] ?? "");
    }
  }
  if (Array.isArray(changed.players)) {
    const previousPlayers = new Map((previous.players || []).map((player) => [player.id, player]));
    for (const player of changed.players) {
      const oldPlayer = previousPlayers.get(player.id);
      if (!oldPlayer || !/^\d{10,}$/.test(player.mobile)) continue;
      if (player.name !== oldPlayer.name) updates[`DATA/${player.mobile}/name`] = player.name;
      if (player.balance !== oldPlayer.balance && player.balanceField) {
        updates[`DATA/${player.mobile}/${player.balanceField}`] = String(player.balance);
      }
      if (player.status !== oldPlayer.status) {
        updates[`Blocked/${player.mobile}`] = player.status === "Blocked" ? true : null;
      }
    }
  }
  if (Array.isArray(changed.requests)) {
    const currentRequests = new Map(changed.requests.map((request) => [request.id, request]));
    for (const request of previous.requests || []) {
      const match = request.id.match(/^(WR|DR)-(.+)$/);
      const updated = currentRequests.get(request.id);
      if (match && updated && updated.status !== "Pending") updates[`${match[1]}/${match[2]}`] = null;
    }
  }
  if (Array.isArray(changed.markets)) {
    const currentMarkets = new Map(changed.markets.map((market) => [market.id, market]));
    for (const oldMarket of previous.markets || []) {
      const currentMarket = currentMarkets.get(oldMarket.id);
      if (oldMarket.legacySource && (!currentMarket
        || currentMarket.legacySource !== oldMarket.legacySource
        || currentMarket.legacyKey !== oldMarket.legacyKey)) {
        updates[`${oldMarket.legacySource}/${oldMarket.legacyKey}`] = null;
      }
    }
    for (const market of changed.markets) {
      if (!market.legacySource || !market.legacyKey || !Array.isArray(market.legacyFields)) continue;
      const oldMarket = (previous.markets || []).find((item) => item.id === market.id);
      if (oldMarket && oldMarket.legacySource === market.legacySource
        && oldMarket.legacyKey === market.legacyKey
        && JSON.stringify(market) === JSON.stringify(oldMarket)) continue;
      const fields = market.legacyFields.slice();
      fields[0] = market.name;
      fields[1] = legacyMarketTime(market.open);
      fields[2] = legacyMarketTime(market.close);
      fields[5] = market.status === "Open" ? "Running" : "Stop";
      if (market.result && market.result !== "—") fields[6] = market.result;
      fields[7] = String(market.position);
      updates[`${market.legacySource}/${market.legacyKey}`] = JSON.stringify(fields);
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
    return;
  }
  if (Object.keys(changed).length === 0) return;
  const updates = {};
  for (const [key, value] of Object.entries(changed)) updates[`adminData/${key}`] = value;
  const legacyUpdates = legacyUpdatesFor(changed, previous);
  Object.assign(updates, legacyUpdates);
  databaseRootRef.update(updates).then(() => {
    lastSyncedData = snapshot;
    if (message) toast(message);
  }).catch((error) => {
    setConnectionStatus("Sync error", "Check database access rules", "error");
    toast(`Save failed: ${error.message}`, true);
  });
}

function money(amount) {
  return `₹${Number(amount || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
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

function pendingRequests() {
  return data.requests.filter((request) => request.status === "Pending").length;
}

function setNav() {
  const root = document.getElementById("navigation");
  root.innerHTML = navigation.map((item) => {
    if (item.section) return `<div class="nav-section">${item.section}</div>`;
    const count = item.count === "pending" ? pendingRequests() : item.count;
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

function marketRows(markets = data.markets.slice(0, 5)) {
  if (!markets.length) return `<div class="empty-state">No markets have been added yet.</div>`;
  return markets.map((market) => `<div class="market-row"><span class="market-mark">${escapeHtml(market.name.slice(0, 2).toUpperCase())}</span><div class="market-info"><strong>${escapeHtml(market.name)}</strong><small>${escapeHtml(market.type)} · ${escapeHtml(market.open)} — ${escapeHtml(market.close)}</small></div>${statusTag(market.status)}<span class="market-result">${escapeHtml(market.result || "—")}</span></div>`).join("");
}

function activityRows() {
  return data.transactions.slice(0, 5).map((transaction) => {
    const positive = transaction.amount >= 0;
    const symbol = transaction.type === "Added" ? "+" : transaction.type === "Winning" ? "★" : "↗";
    const amount = transaction.amountUnavailable ? "—" : `${positive ? "+" : ""}${money(transaction.amount)}`;
    return `<div class="activity-row"><span class="activity-icon">${symbol}</span><div class="activity-copy"><strong>${escapeHtml(transaction.player)}</strong> · ${escapeHtml(transaction.type)} <small>${escapeHtml(transaction.note)} · ${escapeHtml(transaction.date)}</small><small>Last seen · ${escapeHtml(lastSeenLabel(transaction.mobile))}</small></div><strong style="color:${positive ? "#16866f" : "#687589"}">${amount}</strong></div>`;
  }).join("") || `<div class="empty-state">No recent activity.</div>`;
}

function dashboardPage() {
  const balance = data.players.reduce((sum, player) => sum + Number(player.balance || 0), 0);
  const added = data.transactions.filter((item) => item.type === "Added").reduce((sum, item) => sum + item.amount, 0);
  const waiting = pendingRequests();
  const active = data.players.filter((player) => player.status === "Active").length;
  const today = new Date().toLocaleDateString("en-CA");
  return `${pageHeading("Dashboard", "Your Kalyan Gold operations at a glance.", button("＋ Add player", "add-player", "primary") + button("Update results", "go-results"))}
    <div class="grid stats-grid">
      <article class="stat-card"><div class="stat-top"><span>Total players</span><span class="stat-icon">♙</span></div><div class="stat-value">${data.players.length}</div><div class="stat-foot"><span class="up">${active} active</span> · ${data.players.length - active} blocked</div></article>
      <article class="stat-card"><div class="stat-top"><span>Today's logins</span><span class="stat-icon">↗</span></div><div class="stat-value">${todayLoginCount}</div><div class="stat-foot">New users · <button class="panel-link" data-page="new-users">View users →</button></div></article>
      <article class="stat-card"><div class="stat-top"><span>Wallet balances</span><span class="stat-icon">₹</span></div><div class="stat-value">${money(balance)}</div><div class="stat-foot">Across all player accounts</div></article>
      <article class="stat-card"><div class="stat-top"><span>Pending requests</span><span class="stat-icon">⇄</span></div><div class="stat-value">${waiting}</div><div class="stat-foot">${waiting ? "Needs your review" : "All requests reviewed"}</div></article>
      <article class="stat-card"><div class="stat-top"><span>Total added</span><span class="stat-icon">↗</span></div><div class="stat-value">${money(added)}</div><div class="stat-foot">${data.transactions.filter((item) => item.type === "Added" && item.date.startsWith(today)).length} credits today</div></article>
    </div>
    <div class="grid overview-grid">
      <section class="panel"><div class="panel-head"><div><h2>Market overview</h2><p>Current market status and latest results</p></div><button class="panel-link" data-page="markets">View all markets →</button></div><div class="market-list">${marketRows()}</div></section>
      <section class="panel"><div class="panel-head"><div><h2>Recent activity</h2><p>Latest wallet and game activity</p></div><button class="panel-link" data-page="transactions">All activity →</button></div><div class="activity-list">${activityRows()}</div></section>
    </div>
    <section class="quick-section"><div class="section-heading"><h2>Quick access</h2><span>Manage your admin tools</span></div><div class="grid quick-grid">
      ${iconCard("players", "Players", "Search & manage", "players")}
      ${iconCard("requests", "Payment requests", `${waiting} awaiting review`, "requests")}
      ${iconCard("markets", "Markets & games", "Schedules & status", "markets")}
      ${iconCard("results", "Update results", "Publish market results", "results")}
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
  return `<div class="table-wrap"><table><thead><tr><th>Player</th><th>Mobile</th><th>Balance</th><th>Played</th><th>Joined</th><th>Last seen</th><th>Status</th><th>Game access</th><th>Actions</th></tr></thead><tbody>${rows.map((player) => `<tr>
    <td><div class="table-primary"><span class="user-avatar">${escapeHtml(player.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase())}</span><span><strong>${escapeHtml(player.name)}</strong><small>${player.approved ? "Approved account" : "Awaiting approval"}</small></span></div></td>
    <td>${escapeHtml(player.mobile)}</td><td><strong>${money(player.balance)}</strong></td><td>${money(player.played)}</td><td>${dateLabel(player.joined)}</td><td>${escapeHtml(lastSeenLabel(player.mobile))}</td><td>${statusTag(player.status)}</td><td>${gameAccessLabel(player.mobile)}</td>
    <td><div class="actions-cell">${whatsappLink(player.mobile)}<button class="button small" data-action="edit-player" data-id="${escapeHtml(player.id)}" title="Edit player">Edit</button><button class="button small" data-action="player-credit" data-id="${escapeHtml(player.id)}" title="Add or withdraw points">₹</button><button class="button small ${player.status === "Blocked" ? "success" : "danger"}" data-action="toggle-player" data-id="${escapeHtml(player.id)}">${player.status === "Blocked" ? "Unblock" : "Block"}</button></div></td>
  </tr>`).join("")}</tbody></table></div>`;
}

function playersPage() {
  const rows = data.players
    .filter((player) => `${player.name} ${player.mobile}`.toLowerCase().includes(playerQuery.toLowerCase()))
    .filter((player) => playerStatusFilter === "All" || (playerStatusFilter === "Pending" ? !player.approved : player.status === playerStatusFilter));
  return `${pageHeading("Players", "Manage player accounts, balances, approvals, and access.", button("＋ Add player", "add-player", "primary"))}
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
    return `<tr><td><strong>${escapeHtml(displayName)}</strong></td><td>${escapeHtml(mobile || "—")}</td><td><code>${escapeHtml(tag)}</code></td><td>${escapeHtml(lastSeenLabel(mobile))}</td><td>${gameAccessLabel(mobile)}</td><td>${whatsappLink(mobile) || "—"}</td></tr>`;
  }).join("");
  return `${pageHeading("Today's new users", `Users who joined on ${dateKey}.`)}
    <section class="panel"><div class="panel-head"><div><h2>Today’s logins</h2></div><span class="status active">${todayNewUsers.length} user${todayNewUsers.length === 1 ? "" : "s"}</span></div>
      ${rows ? `<div class="table-wrap"><table><thead><tr><th>Player</th><th>Mobile</th><th>User tag</th><th>Last seen</th><th>Game access</th><th>Contact</th></tr></thead><tbody>${rows}</tbody></table></div>` : `<div class="empty-state">No users have been recorded for ${dateKey} yet.</div>`}
    </section>`;
}

function requestsPage() {
  const rows = data.requests.filter((request) => (requestFilter === "All" || request.status === requestFilter) && `${request.player} ${request.mobile} ${request.kind} ${request.method} ${request.details || ""}`.toLowerCase().includes(requestQuery.toLowerCase()));
  return `${pageHeading("Payment requests", "Withdrawal points are reserved when submitted. Refund restores them; Delete removes the request without refunding.", button("＋ Record payment", "manual-payment", "primary"))}
    <section class="panel"><div class="toolbar"><div class="search-wrap"><span class="search-mark">⌕</span><input id="request-search" class="field" type="search" placeholder="Search player, mobile, or method..." value="${escapeHtml(requestQuery)}"></div><select id="request-filter" class="select">${["All", "Pending", "Approved", "Refunded", "Rejected", "Deleted"].map((value) => `<option${requestFilter === value ? " selected" : ""}>${value}</option>`).join("")}</select><span class="stat-foot">${rows.length} request${rows.length === 1 ? "" : "s"}</span></div>
    ${rows.length ? `<div class="table-wrap"><table><thead><tr><th>Player</th><th>Last seen</th><th>Request</th><th>Amount</th><th>Method &amp; details</th><th>Submitted</th><th>Status</th><th>Action</th></tr></thead><tbody>${rows.map((request) => `<tr><td><div class="table-primary"><span class="user-avatar">${escapeHtml(request.player[0])}</span><span><strong>${escapeHtml(request.player)}</strong><small>${escapeHtml(request.mobile)}</small></span></div></td><td>${escapeHtml(lastSeenLabel(request.mobile))}</td><td>${escapeHtml(request.kind)}</td><td><strong>${request.amountUnavailable ? "—" : money(request.amount)}</strong></td><td>${escapeHtml(request.method)}${request.details ? `<small style="display:block;max-width:280px;white-space:normal;color:#687589;margin-top:3px">${escapeHtml(request.details)}</small>` : ""}</td><td>${escapeHtml(request.created)}</td><td>${statusTag(request.status)}</td><td>${request.status === "Pending" ? `<div class="actions-cell"><button class="button small success" data-action="resolve-request" data-id="${escapeHtml(request.id)}" data-status="Approved" ${request.amountUnavailable ? "disabled title=\"Legacy request amount is not mapped\"" : ""}>Approve</button>${request.kind === "Withdrawal" ? `<button class="button small danger" data-action="resolve-request" data-id="${escapeHtml(request.id)}" data-status="Refunded" ${request.amountUnavailable || (request.balanceDeducted && !data.players.some((player) => player.mobile === request.mobile)) ? "disabled title=\"Player or refund amount is unavailable\"" : ""}>Refund</button>` : `<button class="button small danger" data-action="resolve-request" data-id="${escapeHtml(request.id)}" data-status="Rejected">Reject</button>`}<button class="button small" data-action="resolve-request" data-id="${escapeHtml(request.id)}" data-status="Deleted">Delete</button></div>` : "—"}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty-state">No requests match this filter.</div>`}</section>`;
}

function marketsPage() {
  return `${pageHeading("Markets & games", "Manage market schedules, open/close status, and results.", button("＋ Add market", "add-market", "primary"))}
    <div class="grid two-col">${data.markets.map((market) => `<article class="market-card"><div class="market-card-top"><div><h3>${escapeHtml(market.name)}</h3><p>${escapeHtml(market.type)}</p></div>${statusTag(market.status)}</div><div class="market-details"><span>◷ ${escapeHtml(market.open)} – ${escapeHtml(market.close)}</span><span>Position ${escapeHtml(market.position)}</span></div><div class="result-display">${escapeHtml(market.result || "—")}</div><div class="button-row" style="margin-top:13px"><button class="button small" data-action="edit-market" data-id="${escapeHtml(market.id)}">Edit market</button><button class="button small" data-action="edit-result" data-id="${escapeHtml(market.id)}">Update result</button><button class="button small ${market.status === "Open" ? "danger" : "success"}" data-action="toggle-market" data-id="${escapeHtml(market.id)}">${market.status === "Open" ? "Close" : "Open"}</button><button class="button small danger" data-action="delete-market" data-id="${escapeHtml(market.id)}">Delete</button></div></article>`).join("") || `<div class="panel empty-state">No markets added yet.</div>`}</div>`;
}

function resultsPage() {
  const market = data.markets.find((item) => item.id === resultMarketSelection) || data.markets[0];
  if (market && !data.markets.some((item) => item.id === resultMarketSelection)) resultMarketSelection = market.id;
  const date = resultDateSelection;
  const sameDayResults = (market?.results || []).filter((item) => item.date === date);
  const storedResult = sameDayResults.find((item) => item.session === resultSessionSelection)?.result
    || sameDayResults.find((item) => !item.session)?.result
    || (date === localDateKey() ? market?.result : "");
  const baseResult = sameDayResults.find((item) => item.session !== resultSessionSelection)?.result
    || sameDayResults.find((item) => item.session === resultSessionSelection)?.result
    || sameDayResults.find((item) => !item.session)?.result
    || market?.result;
  const preview = market && resultPanelDraft.length === 3
    ? buildMarketResult(market, resultSessionSelection, resultPanelDraft, baseResult)
    : storedResult || "";
  const winners = resultWinners(market, preview, date, resultSessionSelection);
  const settlementId = market ? `${market.id}|${date}|${resultSessionSelection}` : "";
  const settlement = data.settlements.find((item) => item.id === settlementId);
  const winnerGroups = new Map();
  for (const winner of winners) {
    const group = winnerGroups.get(winner.selection) || [];
    group.push(winner);
    winnerGroups.set(winner.selection, group);
  }
  const groupedWinners = winnerGroups.size ? `<div class="grid two-col">${Array.from(winnerGroups.entries()).map(([number, entries]) => `<section class="panel"><div class="panel-head"><div><h2>Number: ${escapeHtml(number)}</h2><p>${entries.length} winning bid${entries.length === 1 ? "" : "s"}</p></div><strong>${money(entries.reduce((sum, entry) => sum + entry.winningAmount, 0))}</strong></div><div class="table-wrap"><table><thead><tr><th>Mobile</th><th>Name</th><th>Bet</th><th>Win amount</th><th>Action</th></tr></thead><tbody>${entries.map((entry) => `<tr><td>${escapeHtml(entry.mobile || "—")}</td><td>${escapeHtml(entry.player)}</td><td>${money(entry.points)}</td><td><strong>${money(entry.winningAmount)}</strong></td><td>${isEditableBid(entry) ? `<button class="button small" data-action="edit-bid" data-id="${escapeHtml(entry.id)}">Change number</button>` : `<span title="The source bid could not be matched safely.">Not editable</span>`}</td></tr>`).join("")}</tbody></table></div></section>`).join("")}</div>` : `<div class="empty-state">${preview ? "No bids match this market result for the selected date and session." : "Enter a 3-digit panel and publish the result to check winning bids."}</div>`;
  const history = data.markets.flatMap((item) => (item.results || []).map((result) => ({ market: item, ...result })))
    .sort((left, right) => String(right.date).localeCompare(String(left.date))).slice(0, 30);
  const resultHistory = history.length ? `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Market</th><th>Session</th><th>Result</th><th></th></tr></thead><tbody>${history.map((item) => `<tr><td>${escapeHtml(item.date)}</td><td>${escapeHtml(item.market.name)}</td><td>${escapeHtml(item.session || "—")}</td><td><strong>${escapeHtml(item.result)}</strong></td><td><button class="button small" data-action="load-result" data-id="${escapeHtml(item.market.id)}" data-session="${escapeHtml(item.session || "Open")}" data-date="${escapeHtml(item.date)}" data-result="${escapeHtml(item.result)}">Review / correct</button></td></tr>`).join("")}</tbody></table></div>` : `<div class="empty-state">No published results recorded yet.</div>`;
  return `${pageHeading("Update results", "Select the market and session, enter the panel as in the AIA app, review matching bids, then distribute winnings.", button("Market settings", "go-markets"))}
    <section class="panel"><div class="panel-head"><div><h2>Publish a market result</h2><p>Main markets combine open and close panels; Starline shows one panel and its single digit.</p></div></div>
      ${market ? `<form id="result-form"><div class="form-grid">
        <div class="form-field"><label for="result-market">Market</label><select id="result-market" name="market" class="select" required>${data.markets.map((item) => `<option value="${escapeHtml(item.id)}"${item.id === market.id ? " selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}</select></div>
        <div class="form-field"><label for="result-session">Session</label><select id="result-session" name="session">${["Open", "Close"].map((session) => `<option${resultSessionSelection === session ? " selected" : ""}>${session}</option>`).join("")}</select></div>
        <div class="form-field"><label for="result-date">Result date</label><input id="result-date" name="date" type="date" class="field" value="${escapeHtml(date)}" required></div>
        <div class="form-field"><label for="result-panel">Panel number</label><input id="result-panel" name="panel" class="field" value="${escapeHtml(resultPanelDraft)}" placeholder="Enter 3-digit panel" inputmode="numeric" maxlength="3" pattern="[0-9]{3}" required></div>
        </div><div class="panel" style="margin-top:15px;text-align:center"><small>${escapeHtml(market.name)} · ${escapeHtml(resultSessionSelection)} result</small><h2 id="result-preview" style="font-size:24px;margin:8px 0">${escapeHtml(preview || market.result || "### - ## - ###")}</h2><p class="hint">The single digit is derived from the panel. The jodi is completed when both market sessions are known.</p></div>
        <div class="button-row" style="margin-top:18px"><button class="button primary" type="submit">Update result &amp; review bids</button><button class="button" type="button" data-action="clear-result">Clear panel</button></div></form>` : `<div class="empty-state">Add a market before publishing a result.</div>`}
    </section>
    ${market ? `<section class="panel" style="margin-top:16px"><div class="panel-head"><div><h2>Winning bids · ${escapeHtml(market.name)}</h2><p>${escapeHtml(date)} · ${escapeHtml(resultSessionSelection)} · result ${escapeHtml(preview || "not published")}</p></div><div class="button-row">${settlement ? `<span class="status approved">Already distributed · ${money(settlement.total)}</span>` : `<button class="button primary" data-action="distribute-winnings" data-id="${escapeHtml(market.id)}" data-date="${escapeHtml(date)}" data-session="${escapeHtml(resultSessionSelection)}" data-result="${escapeHtml(preview)}" ${winners.length ? "" : "disabled"}>Distribute amount · ${money(winners.reduce((sum, entry) => sum + entry.winningAmount, 0))}</button>`}</div></div>${settlement && settlement.result !== preview ? `<div class="warning-box">A different result was already distributed (${escapeHtml(settlement.result)}). This panel will not pay the same session twice; reconcile any correction through reviewed wallet adjustments.</div>` : ""}${groupedWinners}</section>` : ""}
    <section class="panel" style="margin-top:16px"><div class="panel-head"><div><h2>Result history</h2><p>Published results can be reviewed or corrected; new results update the player-app market record.</p></div></div>${resultHistory}</section>`;
}

function ratesPage() {
  return `${pageHeading("Rate chart", "Edit the payout rates used for each game type.", button("Reset defaults", "reset-rates"))}
    <section class="panel"><div class="panel-head"><div><h2>Game payout rates</h2></div></div>
    <form id="rates-form"><div class="table-wrap"><table><thead><tr><th>Game type</th><th>Example</th><th>Payout rate</th><th>Per ₹1</th></tr></thead><tbody>${data.rates.map((rate, index) => `<tr><td><strong>${escapeHtml(rate.id)}</strong></td><td>${["0 – 9", "00 – 99", "124, 234, 368", "112, 577, 336", "111, 222, 444", "Open + close", "Open + close"][index]}</td><td><input class="field" style="max-width:140px" type="number" min="0" step="0.01" name="${escapeHtml(rate.id)}" value="${escapeHtml(rate.value)}" required></td><td>${money(rate.value)}</td></tr>`).join("")}</tbody></table></div><div class="button-row" style="margin-top:15px"><button class="button primary" type="submit">Save rates</button></div></form></section>`;
}

function transactionTable(rows) {
  return rows.length ? `<div class="table-wrap"><table><thead><tr><th>Reference</th><th>Player</th><th>Last seen</th><th>Type</th><th>Amount</th><th>Date & time</th><th>Details</th></tr></thead><tbody>${rows.map((item) => `<tr><td><strong>${escapeHtml(item.id)}</strong></td><td>${escapeHtml(item.player)}<small style="display:block;color:#9aa3b1;margin-top:3px">${escapeHtml(item.mobile)}</small></td><td>${escapeHtml(lastSeenLabel(item.mobile))}</td><td>${escapeHtml(item.type)}</td><td><strong style="color:${item.amount >= 0 ? "#16866f" : "#475368"}">${item.amountUnavailable ? "—" : `${item.amount > 0 ? "+" : ""}${money(item.amount)}`}</strong></td><td>${escapeHtml(item.date)}</td><td>${escapeHtml(item.note)}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty-state">No matching transactions.</div>`;
}

function transactionsPage() {
  const rows = data.transactions.filter((item) => `${item.player} ${item.mobile} ${item.id} ${item.type} ${item.note}`.toLowerCase().includes(transactionQuery.toLowerCase()));
  const added = data.transactions.filter((item) => item.amount > 0).reduce((sum, item) => sum + item.amount, 0);
  const withdrawn = Math.abs(data.transactions.filter((item) => item.type === "Withdrawal").reduce((sum, item) => sum + item.amount, 0));
  const played = Math.abs(data.transactions.filter((item) => item.type === "Played").reduce((sum, item) => sum + item.amount, 0));
  return `${pageHeading("Transactions", "Review wallet credits, withdrawals, gameplay, and winnings.", button("＋ Record transaction", "manual-payment", "primary"))}
    <div class="grid three-col" style="margin-bottom:15px"><div class="panel metric-mini"><span>Total added</span><strong>${money(added)}</strong></div><div class="panel metric-mini"><span>Total withdrawn</span><strong>${money(withdrawn)}</strong></div><div class="panel metric-mini"><span>Total played</span><strong>${money(played)}</strong></div></div>
    <section class="panel"><div class="toolbar"><div class="search-wrap"><span class="search-mark">⌕</span><input id="transaction-search" class="field" type="search" placeholder="Search player, reference, or type..." value="${escapeHtml(transactionQuery)}"></div><button class="button" data-action="export">Export data</button></div>${transactionTable(rows)}</section>`;
}

function playedPage() {
  const playedPlayers = Array.from(new Map(data.bets.map((bet) => {
    const player = data.players.find((item) => item.id === bet.playerId || item.mobile === bet.playerId);
    const id = bet.playerId || bet.mobile || "";
    return [id, { id, name: bet.player || player?.name || id, mobile: bet.mobile || player?.mobile || id }];
  }).filter(([id]) => id)).values()).sort((left, right) => left.name.localeCompare(right.name));
  if (playedPlayerFilter !== "All" && !playedPlayers.some((player) => player.id === playedPlayerFilter)) {
    playedPlayerFilter = "All";
  }
  const rows = data.bets
    .filter((bet) => {
      const player = data.players.find((item) => item.id === bet.playerId || item.mobile === bet.playerId);
      const mobile = bet.mobile || player?.mobile || bet.playerId || "";
      return (playedPlayerFilter === "All" || (bet.playerId || mobile) === playedPlayerFilter)
        && `${bet.player} ${mobile} ${bet.market} ${bet.session} ${bet.type} ${bet.number}`.toLowerCase().includes(playedQuery.toLowerCase());
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
  return `${pageHeading("Bid history & played games", "Review player bids from the website and legacy AIA records, filter by player, and change a bid number.", button("Player list", "go-players"))}<section class="panel"><div class="panel-head"><div><h2>Player game activity</h2><p>${playedPlayers.length} player${playedPlayers.length === 1 ? "" : "s"} · ${rows.length} bid${rows.length === 1 ? "" : "s"} shown</p></div></div><div class="toolbar"><div class="search-wrap"><span class="search-mark">⌕</span><input id="played-search" class="field" type="search" placeholder="Search player, mobile, market, or number..." value="${escapeHtml(playedQuery)}"></div><select id="played-player-filter" class="select"><option value="All">All players</option>${playedPlayers.map((player) => `<option value="${escapeHtml(player.id)}"${playedPlayerFilter === player.id ? " selected" : ""}>${escapeHtml(player.name)} · ${escapeHtml(player.mobile)}</option>`).join("")}</select></div>${table}</section>`;
}

function reportsPage() {
  const balance = data.players.reduce((sum, player) => sum + Number(player.balance || 0), 0);
  const totalAdded = data.transactions.filter((item) => item.type === "Added").reduce((sum, item) => sum + item.amount, 0);
  const totalWithdraw = Math.abs(data.transactions.filter((item) => item.type === "Withdrawal").reduce((sum, item) => sum + item.amount, 0));
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return { label: date.toLocaleDateString("en", { weekday: "short" }), key: date.toLocaleDateString("en-CA"), value: data.transactions.filter((item) => item.date.startsWith(date.toLocaleDateString("en-CA")) && item.amount > 0).reduce((sum, item) => sum + item.amount, 0) };
  });
  const max = Math.max(...days.map((day) => day.value), 1);
  return `${pageHeading("Reports", "A summary of account activity and player balances.", button("Export data", "export"))}
    <div class="grid three-col" style="margin-bottom:15px"><div class="panel metric-mini"><span>Total player balance</span><strong>${money(balance)}</strong></div><div class="panel metric-mini"><span>Lifetime added</span><strong>${money(totalAdded)}</strong></div><div class="panel metric-mini"><span>Lifetime withdrawn</span><strong>${money(totalWithdraw)}</strong></div></div>
    <section class="panel"><div class="panel-head"><div><h2>Credits · last 7 days</h2></div></div><div class="bar-chart">${days.map((day) => `<div class="bar-item"><strong>${day.value ? money(day.value) : ""}</strong><div class="bar" style="height:${Math.max(day.value / max * 68, day.value ? 7 : 2)}%"></div><span>${day.label}</span></div>`).join("")}</div></section>`;
}

function noticesPage() {
  return `${pageHeading("Notices", "Edit the notice shown to players or create an announcement.", button("Send broadcast", "broadcast", "primary"))}
    <section class="panel"><div class="panel-head"><div><h2>Player notice</h2></div></div><form id="notice-form"><div class="form-grid"><div class="form-field full"><label for="notice-title">Title</label><input id="notice-title" class="field" name="title" maxlength="80" value="${escapeHtml(data.settings.noticeTitle)}" required></div><div class="form-field full"><label for="notice-message">Message</label><textarea id="notice-message" class="textarea" name="message" rows="4" maxlength="500" required>${escapeHtml(data.settings.noticeMessage)}</textarea></div></div><div class="button-row" style="margin-top:15px"><button class="button primary" type="submit">Update message</button><button class="button" type="button" data-action="broadcast">Compose broadcast</button></div></form></section>
    <section class="panel" style="margin-top:15px"><div class="panel-head"><div><h2>Broadcast notice</h2><p>Compose an announcement. Push notification delivery requires a configured provider.</p></div></div><button class="button" data-action="broadcast">Compose notice</button></section>`;
}

function settingsPage() {
  const settings = data.settings;
  const line = (key, title, description) => `<div class="settings-row"><div><strong>${title}</strong><small>${description}</small></div><input class="toggle" type="checkbox" data-setting="${key}" ${settings[key] ? "checked" : ""}></div>`;
  return `${pageHeading("Game settings", "Manage player website settings, maintenance, and game availability.")}
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
        <div class="form-field"><label for="minimum-withdrawal">Minimum withdrawal (₹)</label><input id="minimum-withdrawal" class="field" name="minimumWithdrawal" type="number" min="0" step="1" value="${escapeHtml(settings.minimumWithdrawal)}" required></div>
        <div class="form-field"><label for="player-website-url">Results website URL</label><input id="player-website-url" class="field" name="websiteUrl" type="text" value="${escapeHtml(settings.websiteUrl)}" placeholder="https://example.com"></div>
        <div class="form-field"><label for="result-chart-url">Market result chart URL</label><input id="result-chart-url" class="field" name="resultChartUrl" type="text" value="${escapeHtml(settings.resultChartUrl)}" placeholder="https://example.com/results"></div>
        <div class="form-field"><label for="support-contact-url">WhatsApp support URL</label><input id="support-contact-url" class="field" name="contactUrl" type="text" value="${escapeHtml(settings.contactUrl)}" placeholder="https://wa.me/91..."></div>
        <div class="form-field"><label for="telegram-url">Telegram URL</label><input id="telegram-url" class="field" name="telegramUrl" type="text" value="${escapeHtml(settings.telegramUrl)}" placeholder="https://t.me/..."></div>
        <div class="form-field full"><label for="player-policy">Privacy policy</label><textarea id="player-policy" class="textarea" name="policy" rows="5" maxlength="8000">${escapeHtml(settings.policy)}</textarea></div>
      </div><div class="button-row" style="margin-top:15px"><button class="button primary" type="submit">Save player website settings</button></div></form>
    </section>`;
}

function detailsPage() {
  return `${pageHeading("Admin profile", "Kalyan Gold administrator workspace.", button("Back to dashboard", "go-dashboard"))}
    <section class="panel"><div class="table-primary" style="margin-bottom:18px"><span class="user-avatar" style="width:45px;height:45px;font-size:16px">A</span><span><strong>Kalyan Gold Admin</strong><small>Administrator workspace</small></span></div><p style="font-size:12px;color:#778397;line-height:1.7">Sign-in is required to open this panel. Database access should also be restricted to authorized administrators.</p><div class="button-row">${button("Export data backup", "export", "primary")}${button("Import data backup", "import-data")}</div></section>`;
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

function panelSingle(panel) {
  return /^\d{3}$/.test(String(panel || ""))
    ? String([...panel].reduce((sum, digit) => sum + Number(digit), 0) % 10)
    : "";
}

function buildMarketResult(market, session, panel, baseResult = market.result) {
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
  const type = String(value || "").trim().toLowerCase();
  if (type === "single" || type === "single digit") return "Single Digit";
  if (type === "jodi" || type === "double digit" || type === "jodi digit") return "Jodi Digit";
  if (type === "single pana") return "Single Pana";
  if (type === "double pana") return "Double Pana";
  if (type === "triple pana") return "Triple Pana";
  if (type === "half sangam") return "Half Sangam";
  if (type === "full sangam") return "Full Sangam";
  return "";
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
  if (["Single Pana", "Double Pana", "Triple Pana"].includes(type)) {
    const panel = market.type === "Starline" ? values.openPanel : betSession === "close" ? values.closePanel : values.openPanel;
    return panel && selection === panel ? selection : "";
  }
  if (type === "Half Sangam" && values.openPanel && values.closePanel) {
    if (session !== "Close") return "";
    const selections = [`${values.openPanel}-${panelSingle(values.closePanel)}`, `${panelSingle(values.openPanel)}-${values.closePanel}`];
    return selections.includes(selection) ? selection : "";
  }
  if (type === "Full Sangam" && values.openPanel && values.closePanel) {
    return session === "Close" && selection === `${values.openPanel}-${values.closePanel}` ? selection : "";
  }
  return "";
}

function resultWinners(market, result, date, session) {
  if (!market || !result || !date) return [];
  const rates = new Map(data.rates.map((rate) => [canonicalGameType(rate.id) || rate.id, Number(rate.value)]));
  return data.bets.flatMap((bet) => {
    const type = canonicalGameType(bet.type);
    const bidSession = String(bet.session || "Open").toLowerCase();
    const bothPanelsSettleAtClose = ["Half Sangam", "Full Sangam"].includes(type);
    if (String(bet.market || "").trim().toLowerCase() !== market.name.trim().toLowerCase()
      || resultDateForBid(bet) !== date
      || (bothPanelsSettleAtClose ? session !== "Close" : bidSession !== session.toLowerCase())) return [];
    const selection = winningSelection(bet, market, result, session);
    const rate = rates.get(type);
    const points = Number(bet.points);
    const player = data.players.find((item) => item.id === bet.playerId || item.mobile === (bet.mobile || bet.playerId));
    if (!selection || !Number.isFinite(rate) || !Number.isFinite(points) || points <= 0) return [];
    return [{
      ...bet,
      player: player?.name || bet.player || bet.mobile || "Player",
      mobile: player?.mobile || bet.mobile || bet.playerId || "",
      playerId: player?.id || bet.playerId || bet.mobile,
      selection,
      rate,
      winningAmount: points * rate,
    }];
  }).sort((left, right) => left.selection.localeCompare(right.selection) || left.player.localeCompare(right.player));
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
  const player = activePlayer();
  const transactions = data.transactions.filter((item) => item.mobile === player?.mobile);
  const bets = data.bets.filter((item) => item.playerId === player?.id)
    .slice()
    .sort((left, right) => {
      const leftTime = Date.parse(left.createdAt || left.date);
      const rightTime = Date.parse(right.createdAt || right.date);
      return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
    });
  return `${pageHeading("My game activity", `Game and wallet history for ${escapeHtml(player?.name || "the selected player")}.`, button("Place a game", "go-player-app"))}${playerSelect()}
    <section class="panel" style="margin-top:15px"><div class="panel-head"><div><h2>Game entries</h2><p>${bets.length} ${bets.length === 1 ? "entry" : "entries"}</p></div></div>${bets.length ? `<div class="table-wrap"><table><thead><tr><th>Market</th><th>Session</th><th>Game</th><th>Number</th><th>Points</th><th>Date</th></tr></thead><tbody>${bets.map((bet) => `<tr><td>${escapeHtml(bet.market)}</td><td>${escapeHtml(bet.session)}</td><td>${escapeHtml(bet.type)}</td><td><strong>${escapeHtml(bet.number)}</strong></td><td>${money(bet.points)}</td><td>${escapeHtml(bet.date)}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty-state">No game entries yet.</div>`}</section>
    <section class="panel" style="margin-top:15px"><div class="panel-head"><div><h2>Wallet history</h2><p>${transactions.length} transaction${transactions.length === 1 ? "" : "s"}</p></div></div>${transactionTable(transactions)}</section>`;
}

const pageRenderers = {
  dashboard: dashboardPage, players: playersPage, "new-users": newUsersPage, requests: requestsPage, markets: marketsPage,
  results: resultsPage, rates: ratesPage, transactions: transactionsPage, played: playedPage,
  reports: reportsPage, notices: noticesPage, settings: settingsPage, profile: detailsPage,
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
  document.getElementById("sidebar").classList.remove("open");
  document.querySelector(".mobile-menu").setAttribute("aria-expanded", "false");
  render();
}

function modal(title, body, onSubmit, options = {}) {
  const root = document.getElementById("modal-root");
  root.innerHTML = `<div class="modal-backdrop" data-action="close-modal"><section class="modal ${options.wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}"><div class="modal-head"><h2>${escapeHtml(title)}</h2><button class="modal-close" data-action="close-modal" aria-label="Close">×</button></div><form id="modal-form"><div class="modal-body">${body}</div><div class="modal-foot"><button type="button" class="button" data-action="close-modal">Cancel</button><button type="submit" class="button primary">${escapeHtml(options.submitLabel || "Save")}</button></div></form></section></div>`;
  root.querySelector(".modal").addEventListener("click", (event) => event.stopPropagation());
  root.querySelector(".modal-backdrop").addEventListener("click", (event) => {
    if (event.target === event.currentTarget) root.innerHTML = "";
  });
  root.querySelector("#modal-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (onSubmit(new FormData(event.currentTarget))) root.innerHTML = "";
  });
  root.querySelector("input,select,textarea")?.focus();
}

function playerModal(player) {
  const existing = player || { id: "", name: "", mobile: "", balance: 0, status: "Active", approved: true };
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
    else data.players.unshift({ ...record, id: `p-${Date.now()}`, joined: new Date().toLocaleDateString("en-CA"), played: 0 });
    persist(isEdit ? "Player updated." : "Player added.");
    render();
    return true;
  });
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
    modal("Record payment", `<div class="form-grid"><div class="form-field full"><label>Player</label><select class="select" name="player" required>${data.players.map((item) => `<option value="${item.id}">${escapeHtml(item.name)} · ${escapeHtml(item.mobile)}</option>`).join("")}</select></div><div class="form-field"><label>Action</label><select class="select" name="type"><option>Added</option><option>Withdrawal</option></select></div><div class="form-field"><label>Amount (₹)</label><input class="field" name="amount" type="number" min="1" step="0.01" required></div><div class="form-field full"><label>Note</label><input class="field" name="note" maxlength="100" placeholder="Payment details"></div></div>`, (form) => {
      const selected = data.players.find((item) => item.id === form.get("player"));
      if (!selected) return toast("Select a valid player.", true), false;
      const amount = Number(form.get("amount"));
      if (!Number.isFinite(amount) || amount <= 0) return toast("Enter an amount greater than zero.", true), false;
      const type = form.get("type");
      if (type === "Withdrawal" && selected.balance < amount) return toast("The player's balance is too low for this withdrawal.", true), false;
      selected.balance += type === "Added" ? amount : -amount;
      data.transactions.unshift({ id: `T-${Date.now()}`, player: selected.name, mobile: selected.mobile, type, amount: type === "Added" ? amount : -amount, date: new Date().toLocaleString(), note: String(form.get("note") || "Admin entry").trim() });
      persist("Payment recorded and wallet updated.");
      render();
      return true;
    });
    return;
  }
  modal(`Wallet · ${player.name}`, `<div class="form-grid"><div class="form-field full"><label>Current balance</label><strong>${money(player.balance)}</strong></div><div class="form-field"><label>Action</label><select class="select" name="type"><option>Added</option><option>Withdrawal</option></select></div><div class="form-field"><label>Amount (₹)</label><input class="field" name="amount" type="number" min="1" step="0.01" required></div><div class="form-field full"><label>Note</label><input class="field" name="note" placeholder="Admin wallet adjustment" maxlength="100"></div></div>`, (form) => {
    const amount = Number(form.get("amount"));
    const type = form.get("type");
    if (!Number.isFinite(amount) || amount <= 0) return toast("Enter an amount greater than zero.", true), false;
    if (type === "Withdrawal" && player.balance < amount) return toast("The player's balance is too low for this withdrawal.", true), false;
    player.balance += type === "Added" ? amount : -amount;
    data.transactions.unshift({ id: `T-${Date.now()}`, player: player.name, mobile: player.mobile, type, amount: type === "Added" ? amount : -amount, date: new Date().toLocaleString(), note: String(form.get("note") || "Admin wallet adjustment").trim() });
    persist("Player wallet updated.");
    render();
    return true;
  });
}

function marketModal(market) {
  const item = market || { name: "", type: "Main market", legacySource: "GAMES", open: "11:00", close: "23:00", status: "Open", result: "—", position: data.markets.length + 1 };
  modal(market ? "Edit market" : "Add market", `<div class="form-grid">
    <div class="form-field"><label>Market name</label><input class="field" name="name" value="${escapeHtml(item.name)}" maxlength="60" required></div>
    <div class="form-field"><label>Market day bucket</label><select class="select" name="legacySource">${[["GAMES", "Weekdays (Mon–Fri)"], ["GAMES2", "Saturday"], ["GAMES3", "Sunday"]].map(([source, label]) => `<option value="${source}"${item.legacySource === source ? " selected" : ""}>${label}</option>`).join("")}</select></div>
    <div class="form-field"><label>Open time</label><input class="field" name="open" type="time" value="${escapeHtml(marketTimeInput(item.open))}" required></div>
    <div class="form-field"><label>Close time</label><input class="field" name="close" type="time" value="${escapeHtml(marketTimeInput(item.close))}" required></div>
    <div class="form-field"><label>Position</label><input class="field" name="position" type="number" min="0" value="${item.position}" required></div>
    <div class="form-field"><label>Status</label><select class="select" name="status"><option${item.status === "Open" ? " selected" : ""}>Open</option><option${item.status === "Closed" ? " selected" : ""}>Closed</option></select></div>
    </div>`, (form) => {
    const name = String(form.get("name")).trim();
    const source = String(form.get("legacySource"));
    const duplicate = data.markets.find((entry) => entry.name.toLowerCase() === name.toLowerCase()
      && entry.legacySource === source && entry.id !== item.id);
    if (duplicate) return toast("A market with this name already exists.", true), false;
    const sourceChanged = item.legacySource !== source;
    Object.assign(item, {
      name,
      type: marketTypeFromName(name),
      legacySource: source,
      open: form.get("open"),
      close: form.get("close"),
      position: Number(form.get("position")),
      status: form.get("status"),
    });
    if (!market) {
      item.legacyKey = nextLegacyMarketKey(source);
      item.id = `${source}-${item.legacyKey}`;
      item.legacyFields = [name, legacyMarketTime(item.open), legacyMarketTime(item.close), "Y", "Y", item.status === "Open" ? "Running" : "Stop", "### - ## - ###", String(item.position)];
      data.markets.push(item);
    } else if (sourceChanged) {
      item.legacyKey = nextLegacyMarketKey(source);
      item.id = `${source}-${item.legacyKey}`;
      item.legacyFields = [name, legacyMarketTime(item.open), legacyMarketTime(item.close), "Y", "Y", item.status === "Open" ? "Running" : "Stop", "### - ## - ###", String(item.position)];
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
  const historyItem = { session, date, result, updatedAt: new Date().toISOString() };
  market.results = market.results || [];
  const existingIndex = market.results.findIndex((item) => item.session === session && item.date === date);
  if (existingIndex >= 0) market.results[existingIndex] = historyItem;
  else market.results.unshift(historyItem);
  market[session === "Open" ? "openResult" : "closeResult"] = result;
  market.result = result;
  market.updatedAt = Date.now();
  data.transactions.unshift({ id: `R-${Date.now()}`, player: "System", mobile: "—", type: "Result", amount: 0, date: new Date().toLocaleString(), note: `${market.name} · ${session} · ${date} · ${result}` });
  return result;
}

function distributeWinnings(market, date, session, result) {
  const settlementId = `${market.id}|${date}|${session}`;
  if (data.settlements.some((item) => item.id === settlementId)) {
    toast("Winnings for this market, date, and session have already been distributed.", true);
    return;
  }
  const published = (market.results || []).find((item) => item.date === date && item.session === session);
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
        id: `W-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        player: player.name,
        mobile: player.mobile,
        type: "Winning",
        amount: winner.winningAmount,
        date: new Date(paidAt).toLocaleString(),
        note: `${market.name} · ${session} · ${winner.type} ${winner.number} · ${date}`,
      });
    }
  }
  persist(`Distributed ${money(totalPayout)} to ${payoutItems.length} player${payoutItems.length === 1 ? "" : "s"}.`);
  render();
}

function exportData() {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `kalyan-gold-admin-${new Date().toLocaleDateString("en-CA")}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  toast("Data backup downloaded.");
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
  modal("Compose broadcast", `<div class="form-grid"><div class="form-field full"><label>Broadcast title</label><input class="field" name="title" maxlength="80" value="${escapeHtml(data.settings.noticeTitle)}" required></div><div class="form-field full"><label>Message</label><textarea class="textarea" name="message" rows="4" maxlength="500" required>${escapeHtml(data.settings.noticeMessage)}</textarea><div class="hint">Push notifications are not configured.</div></div></div>`, (form) => {
    data.settings.noticeTitle = String(form.get("title")).trim();
    data.settings.noticeMessage = String(form.get("message")).trim();
    persist("Broadcast message saved. Push delivery is not configured.");
    render();
    return true;
  }, { submitLabel: "Save notice" });
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
    case "edit-bid": editBidModal(data.bets.find((bet) => bet.id === id)); break;
    case "toggle-player":
      if (player) {
        player.status = player.status === "Blocked" ? "Active" : "Blocked";
        persist(`Player ${player.status.toLowerCase()}.`);
        render();
      }
      break;
    case "resolve-request": {
      const request = data.requests.find((item) => item.id === id);
      if (!request || request.status !== "Pending") break;
      if (control.dataset.status === "Refunded" || control.dataset.status === "Deleted") {
        const warning = control.dataset.status === "Refunded"
          ? `Refund ${money(request.amount)} to ${request.player} and close this withdrawal?`
          : `Delete this request without changing ${request.player}'s balance?`;
        if (!window.confirm(warning)) break;
      }
      if (request.amountUnavailable && control.dataset.status === "Approved") {
        toast("This legacy request does not expose a supported amount field and cannot be approved here.", true);
        break;
      }
      const target = data.players.find((item) => item.mobile === request.mobile);
      if (control.dataset.status === "Approved" && (!target || !target.balanceField)) {
        toast("Cannot approve this request because the player account has no supported balance field.", true);
        break;
      }
      if (control.dataset.status === "Refunded"
        && (request.kind !== "Withdrawal" || !request.balanceDeducted || !target || !target.balanceField || request.amountUnavailable)) {
        toast("Cannot refund: the reserved withdrawal amount or player balance field is unavailable.", true);
        break;
      }
      if (control.dataset.status === "Approved" && !["Deposit", "Withdrawal"].includes(request.kind)) {
        toast("Cannot approve a request with an unsupported payment type.", true);
        break;
      }
      if (control.dataset.status === "Approved" && request.kind === "Deposit" && target) {
        target.balance += request.amount;
        data.transactions.unshift({ id: `T-${Date.now()}`, player: target.name, mobile: target.mobile, type: "Added", amount: request.amount, date: new Date().toLocaleString(), note: `Approved ${request.kind.toLowerCase()} request` });
      } else if (control.dataset.status === "Approved" && request.kind === "Withdrawal" && target) {
        if (!request.balanceDeducted && target.balance < request.amount) {
          toast("Cannot approve: the player's balance is too low.", true);
          break;
        }
        if (!request.balanceDeducted) target.balance -= request.amount;
        data.transactions.unshift({ id: `T-${Date.now()}`, player: target.name, mobile: target.mobile, type: "Withdrawal", amount: -request.amount, date: new Date().toLocaleString(), note: "Approved withdrawal request" });
      } else if (control.dataset.status === "Refunded" && target) {
        target.balance += request.amount;
        data.transactions.unshift({ id: `T-${Date.now()}`, player: target.name, mobile: target.mobile, type: "Added", amount: request.amount, date: new Date().toLocaleString(), note: "Refunded reserved withdrawal request" });
      }
      request.status = control.dataset.status;
      persist(request.status === "Deleted" ? "Request deleted without changing the player's balance."
        : request.status === "Refunded" ? "Withdrawal refunded to the player's balance."
          : `Request ${request.status.toLowerCase()}.`);
      render();
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
        resultSessionSelection = control.dataset.session || "Open";
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
    await verifyAdminLogin(phone, password);
    setAdminAppVisible(true);
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

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    document.getElementById("sidebar").classList.remove("open");
    document.querySelector(".mobile-menu").setAttribute("aria-expanded", "false");
  }
});

document.addEventListener("input", (event) => {
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
  if (event.target.id === "result-panel") {
    resultPanelDraft = event.target.value.replace(/\D/g, "").slice(0, 3);
    render(true);
  }
});

document.addEventListener("change", (event) => {
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
    const baseResult = (market.results || []).find((item) => item.date === date && item.session === otherSession)?.result
      || (market.results || []).find((item) => item.date === date && item.session === session)?.result
      || (market.results || []).find((item) => item.date === date && !item.session)?.result
      || market.result;
    const result = buildMarketResult(market, session, panel, baseResult);
    if (!result) {
      toast("The result could not be calculated from this panel.", true);
      return;
    }
    resultMarketSelection = market.id;
    resultSessionSelection = session;
    resultDateSelection = date;
    resultPanelDraft = panel;
    saveResult(market, session, date, result);
    persist(`Result saved: ${result}. Review the winners before distributing.`);
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
    const minimumWithdrawal = Number(form.get("minimumWithdrawal"));
    if (!Number.isFinite(signUpBonus) || signUpBonus < 0 ||
        !Number.isFinite(minimumWithdrawal) || minimumWithdrawal < 0) {
      toast("Signup bonus and minimum withdrawal must be valid non-negative amounts.", true);
      return;
    }
    Object.assign(data.settings, {
      signUpBonus,
      minimumWithdrawal,
      websiteUrl: String(form.get("websiteUrl") || "").trim(),
      resultChartUrl: String(form.get("resultChartUrl") || "").trim(),
      contactUrl: String(form.get("contactUrl") || "").trim(),
      telegramUrl: String(form.get("telegramUrl") || "").trim(),
      policy: String(form.get("policy") || "").trim(),
    });
    persist("Player website settings saved.");
    render();
  }
  if (event.target.id === "notice-form") {
    event.preventDefault();
    const form = new FormData(event.target);
    data.settings.noticeTitle = String(form.get("title")).trim();
    data.settings.noticeMessage = String(form.get("message")).trim();
    persist("Player notice saved.");
    render();
  }
});

function startRealtimeSync() {
  if (typeof firebase === "undefined") {
    setConnectionStatus("Connection unavailable", "Check your internet connection", "error");
    document.getElementById("page-content").innerHTML = `<div class="panel empty-state">Could not connect. Check your internet connection and reload this page.</div>`;
    return;
  }

  try {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    databaseRootRef = firebase.database().ref();
    databaseRef = databaseRootRef.child("adminData");
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
