const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "site-app.webjs"), "utf8");
const websiteHtml = fs.readFileSync(path.join(__dirname, "index2.html"), "utf8");
const themeCss = fs.readFileSync(path.join(__dirname, "sridevi-matka-theme.css"), "utf8");

function between(start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex);
  assert.notEqual(startIndex, -1, `Missing source marker: ${start}`);
  assert.notEqual(endIndex, -1, `Missing source marker: ${end}`);
  return source.slice(startIndex, endIndex);
}

const ruleSource = [
  between("const SP_MOTOR_ROWS = [", "const MARKET_CATEGORIES = ["),
  between("function isThreeDigitPanel(value)", "function renderBetting()")
].join("\n");
const backHandlerSource = between(
  "function handleBackWebsiteMessage() {",
  "window.__dpboss60HandleBack ="
);
const nativeBackHandlerSource = between(
  "function installNativeBackMessageHandler() {",
  "installNativeBackMessageHandler();"
);
const textBoostSource = between(
  "function bumpNonHomePageText(root) {",
  "async function renderPage()"
);
const appBackSource = between(
  "function handleAppBack() {",
  "function notifyApplicationBack() {"
);
const withdrawalDetailsSource = between(
  "function withdrawalCacheKey() {",
  "function renderNotices()"
);

const ruleContext = { money: amount => `₹ ${amount}` };
vm.runInNewContext(`${ruleSource}\nglobalThis.rules = {
  SP_PANA_SET, DP_PANA_SET, TP_PANA_SET, SANGAM_PANA_SET,
  getBetGridOptions, getMotorNumbers, buildBetSelections, mergeBetDraft, betDraftTotals
};`, ruleContext);

function createSubmissionContext(dbPatchAndVerify) {
  const state = {
    accountBlocked: false,
    maintenance: false,
    markets: [{ name: "Market A" }],
    marketBucket: "GAMES",
    selectedMarket: "Market A",
    selectedSession: "Open",
    selectedGame: "Single",
    betDraft: [{ selection: "5", amount: 10, session: "Open" }],
    balance: 100,
    balancePath: "DATA/1234567890/COINS",
    minimumEntry: 0,
    maximumEntry: 50,
    openBets: true,
    closeBets: true,
    bidSubmitting: false,
    category: "Main",
    user: { phone: "1234567890" },
    bids: [],
    pointsHistory: []
  };
  const calls = { patches: [], notifications: [], pages: [] };
  const button = {};
  const context = {
    state,
    DATABASE_ROOTS: { bidRecords: "Normal T Data", bidHistory: "Normal T Data2" },
    query: () => ({ querySelector: () => button }),
    marketSessions: market => market.status === "Closed" ? [] : ["Open"],
    marketBucketForToday: () => "GAMES",
    normalizeMarkets: markets => markets,
    notify: (message, type) => calls.notifications.push({ message, type }),
    money: amount => `₹ ${amount}`,
    setBusy: (target, busy) => { target.busy = busy; },
    dbGet: async path => path === "GAMES"
      ? [{ name: "Market A", status: "Running" }]
      : state.balance,
    decodeFirebaseValue: value => value,
    marketNow: () => new Date("2026-01-02T03:04:05.000Z"),
    dbKey: value => String(value).replace(/[.#$\[\]/]/g, "_"),
    legacyGameType: value => value,
    phonePath: value => encodeURIComponent(value),
    dbPatchAndVerify: async updates => {
      calls.patches.push(updates);
      return dbPatchAndVerify(updates);
    },
    showAppDialog: message => calls.notifications.push({ message, type: "dialog" }),
    setPage: page => calls.pages.push(page),
    calls
  };
  vm.runInNewContext(
    `${between("async function submitBid() {", "function addBetDraft(")}\nglobalThis.submitBid = submitBid;`,
    context
  );
  return { context, state, calls, button };
}

test("grid options follow the existing game number sets", () => {
  const { rules } = ruleContext;
  assert.deepEqual(Array.from(rules.getBetGridOptions("Single")), Array.from({ length: 10 }, (_, n) => String(n)));
  assert.equal(rules.getBetGridOptions("Jodi").length, 100);
  assert.equal(rules.getBetGridOptions("Jodi")[99], "99");
  assert.deepEqual(
    Array.from(rules.getBetGridOptions("Single Pana")),
    Array.from(rules.SP_PANA_SET)
  );
  assert.deepEqual(
    Array.from(rules.getBetGridOptions("Double Pana")),
    Array.from(rules.DP_PANA_SET)
  );
  assert.deepEqual(
    Array.from(rules.getBetGridOptions("Triple Pana")),
    Array.from(rules.TP_PANA_SET)
  );
  assert.equal(rules.getBetGridOptions("Half Sangam").length, rules.SANGAM_PANA_SET.size);
  assert.equal(rules.getBetGridOptions("Half Sangam", "128").length, 10);
});

test("bulk game tiles are not included in the playable game list", () => {
  const gameTypes = between("const GAME_TYPES = [", "const GAME_ART = {");
  assert.doesNotMatch(gameTypes, /Single Digit Bulk|Bulk Jodi|Single Pana Bulk|Double Pana Bulk|Triple Pana Bulk/);
});

test("website navigation uses one shared menu/back button", () => {
  assert.match(websiteHtml, /id="menu-toggle"[^>]*data-drawer-toggle/);
  assert.doesNotMatch(websiteHtml, /id="back-button"/);
  const menuHandler = between(
    'if (target.hasAttribute("data-drawer-toggle")) {',
    'if (target.dataset.authMode)'
  );
  assert.match(menuHandler, /if \(state\.page === "home"\)\s*\{\s*setPage\("profile"\);/);
  assert.doesNotMatch(menuHandler, /classList\.toggle\("open"\)/);
});

test("non-home page text increases by one pixel without changing home or profile", () => {
  const textElement = {
    tagName: "P",
    textContent: "Page content",
    dataset: {},
    style: {},
    getAttribute: () => null
  };
  const context = {
    state: { page: "deposit" },
    window: { getComputedStyle: () => ({ fontSize: "14px" }) }
  };
  vm.runInNewContext(`${textBoostSource}\nglobalThis.bump = bumpNonHomePageText;`, context);
  const root = { querySelectorAll: () => [textElement] };

  context.bump(root);
  assert.equal(textElement.style.fontSize, "15px");
  context.bump(root);
  assert.equal(textElement.style.fontSize, "15px");

  context.state.page = "home";
  textElement.dataset.fontBoosted = undefined;
  textElement.style.fontSize = "";
  context.bump(root);
  assert.equal(textElement.style.fontSize, "");
});

test("Telegram and WhatsApp home buttons use a matching white border", () => {
  const telegramRule = themeCss.slice(themeCss.indexOf(".aia-home-contact-row .support-number-telegram {"));
  const whatsappRule = themeCss.slice(themeCss.lastIndexOf(".aia-home-contact-row .support-number-whatsapp {"));
  assert.notEqual(telegramRule, themeCss);
  assert.notEqual(whatsappRule, themeCss);
  assert.match(telegramRule.slice(0, telegramRule.indexOf("}")), /border:\s*1px solid #fff/);
  assert.match(whatsappRule.slice(0, whatsappRule.indexOf("}")), /border:\s*1px solid #fff/);
});

test("home support links show Telegram and WhatsApp labels instead of phone numbers", () => {
  const homeOverview = between("function renderHomeOverview()", "function availableMarketCategories()");
  assert.match(homeOverview, /<strong>Telegram<\/strong>/);
  assert.match(homeOverview, /<strong>WhatsApp<\/strong>/);
  assert.doesNotMatch(homeOverview, /href="tel:|phoneNumber|supportContact\.local/);
});

test("number validation and motor generation use the existing rules", () => {
  const { rules } = ruleContext;
  assert.deepEqual(
    Array.from(rules.buildBetSelections("SP Motor", "Open", "0", "")),
    Array.from(rules.getMotorNumbers("SP Motor", "0"))
  );
  assert.equal(rules.buildBetSelections("Single", "Open", "7", "")[0], "7");
  assert.throws(() => rules.buildBetSelections("Single", "Open", "17", ""));
  assert.throws(() => rules.buildBetSelections("Full Sangam", "Close", "128", "777"));
  assert.throws(() => rules.buildBetSelections("Half Sangam", "Open", "001", "2"));
});

test("draft taps accumulate matching numbers and enforce per-number maximum", () => {
  const { rules } = ruleContext;
  const draft = rules.mergeBetDraft([], ["5"], 10, "Open", 25);
  const accumulated = rules.mergeBetDraft(draft, ["5"], 15, "Open", 25);
  assert.equal(accumulated.length, 1);
  assert.equal(accumulated[0].amount, 25);
  assert.throws(
    () => rules.mergeBetDraft(accumulated, ["5"], 1, "Open", 25),
    /per-number maximum/
  );
  const otherSession = rules.mergeBetDraft(accumulated, ["5"], 10, "Close", 25);
  assert.equal(otherSession.length, 2);
});

test("draft totals report bid count, remaining balance, and shortfall", () => {
  const { rules } = ruleContext;
  assert.deepEqual(
    JSON.parse(JSON.stringify(rules.betDraftTotals([
      { selection: "1", amount: 10 },
      { selection: "2", amount: 15 }
    ], 40))),
    { count: 2, total: 25, remaining: 15, shortfall: 0 }
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(rules.betDraftTotals([
      { selection: "1", amount: 30 }
    ], 20))),
    { count: 1, total: 30, remaining: 0, shortfall: 10 }
  );
});

test("bid submission updates balance and history once after a successful write", async () => {
  const { context, state, calls } = createSubmissionContext(async () => {});
  await context.submitBid();
  assert.equal(state.balance, 90);
  assert.equal(state.bids.length, 1);
  assert.equal(state.pointsHistory.length, 1);
  assert.equal(state.betDraft.length, 0);
  assert.deepEqual(calls.pages, ["game-select"]);
  assert.equal(calls.patches.length, 1);
  assert.equal(state.bidSubmitting, false);
});

test("bid submission refuses a market that closed in Firebase while the page was open", async () => {
  const { context, state, calls } = createSubmissionContext(async () => {});
  context.dbGet = async path => path === "GAMES"
    ? [{ name: "Market A", status: "Closed" }]
    : state.balance;

  await context.submitBid();

  assert.equal(calls.patches.length, 0);
  assert.deepEqual(calls.pages, ["home"]);
  assert.equal(state.balance, 100);
  assert.match(calls.notifications.at(-1).message, /closed/i);
});

test("failed bid write preserves the draft and reports the error", async () => {
  const { context, state, calls } = createSubmissionContext(async () => {
    throw new Error("write failed");
  });
  await context.submitBid();
  assert.equal(state.balance, 100);
  assert.equal(state.betDraft.length, 1);
  assert.equal(state.bids.length, 0);
  assert.equal(calls.notifications.at(-1).message, "write failed");
  assert.equal(state.bidSubmitting, false);
});

test("submission refuses a draft above the available wallet balance", async () => {
  const { context, state, calls } = createSubmissionContext(async () => {});
  state.balance = 5;
  await context.submitBid();
  assert.equal(calls.patches.length, 0);
  assert.equal(state.betDraft.length, 1);
  assert.equal(state.balance, 5);
  assert.equal(calls.notifications.at(-1).type, "dialog");
});

test("concurrent confirmation calls submit only once", async () => {
  let releaseWrite;
  const writePending = new Promise(resolve => { releaseWrite = resolve; });
  const { context, state, calls } = createSubmissionContext(() => writePending);
  const first = context.submitBid();
  const second = context.submitBid();
  await second;
  releaseWrite();
  await first;
  assert.equal(calls.patches.length, 1);
  assert.equal(state.balance, 90);
  assert.equal(state.bidSubmitting, false);
});

test("back messages navigate one website page and reach the app only from home", () => {
  const state = { page: "support", supportDialogVisible: false };
  const pageHistory = ["home", "markets"];
  const calls = [];
  const sidebar = { classList: { contains: () => false } };
  const exitDialog = { classList: { contains: () => true } };
  const context = {
    state,
    pageHistory,
    query: selector => selector === "#sidebar" ? sidebar : exitDialog,
    handleAppBack: () => {
      calls.push("website-back");
      state.page = pageHistory.pop() || "home";
    },
    notifyApplicationBack: () => calls.push("application-back")
  };
  vm.runInNewContext(
    `${backHandlerSource}\nglobalThis.handleBackWebsiteMessage = handleBackWebsiteMessage;`,
    context
  );

  context.handleBackWebsiteMessage();
  assert.equal(state.page, "markets");
  assert.deepEqual(calls, ["website-back"]);

  context.handleBackWebsiteMessage();
  assert.equal(state.page, "home");
  assert.deepEqual(calls, ["website-back", "website-back"]);

  context.handleBackWebsiteMessage();
  assert.deepEqual(calls, ["website-back", "website-back", "application-back"]);
});

test("native back console messages are handled by the website", () => {
  const calls = [];
  const logs = [];
  const context = {
    console: { log: (...args) => logs.push(args) },
    handleBackWebsiteMessage: () => calls.push("website-back")
  };
  vm.runInNewContext(
    `${nativeBackHandlerSource}\ninstallNativeBackMessageHandler();`,
    context
  );
  context.console.log("back-website");
  context.console.log("ordinary-message");
  assert.deepEqual(calls, ["website-back"]);
  assert.deepEqual(logs, [["back-website"], ["ordinary-message"]]);
});

test("back button returns through account details, profile, then home", () => {
  const state = { page: "bank-details", user: { phone: "1234567890" } };
  const pageHistory = ["home", "profile", "bank-details"];
  const calls = [];
  const sidebar = { classList: { contains: () => false } };
  const exitDialog = { classList: { contains: () => true } };
  const context = {
    state,
    pageHistory,
    query: selector => selector === "#sidebar" ? sidebar : exitDialog,
    updateHeaderNavigation: () => {},
    setPage: page => {
      state.page = page;
      if (page === "home") pageHistory.length = 0;
    },
    closeExitDialog: () => {},
    showExitDialog: () => calls.push("exit-dialog")
  };
  vm.runInNewContext(
    `${appBackSource}\nglobalThis.handleAppBack = handleAppBack;`,
    context
  );

  context.handleAppBack();
  assert.equal(state.page, "profile");
  assert.deepEqual(pageHistory, ["home"]);
  context.handleAppBack();
  assert.equal(state.page, "home");
  assert.deepEqual(pageHistory, []);
  context.handleAppBack();
  assert.deepEqual(calls, ["exit-dialog"]);
});

test("withdrawal details save to DATA phone AD and local storage", async () => {
  const storage = new Map([["dpboss60Withdrawal:1234567890", JSON.stringify({ amount: "250" })]]);
  const writes = [];
  const context = {
    state: { user: { phone: "1234567890" } },
    DATABASE_ROOTS: { users: "DATA" },
    phonePath: phone => encodeURIComponent(phone),
    decodeFirebaseValue: value => value,
    localStorage: {
      getItem: key => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value)
    },
    sessionStorage: { getItem: () => null },
    FormData: class {
      constructor(form) { this.values = form.values; }
      get(name) { return this.values[name] || ""; }
    },
    notify: () => {},
    dbPutAndVerify: async (path, value) => writes.push({ path, value })
  };
  vm.runInNewContext(
    `${withdrawalDetailsSource}\nglobalThis.saveWithdrawalDetails = saveWithdrawalDetails;\nglobalThis.savedWithdrawalDetails = savedWithdrawalDetails;`,
    context
  );
  const details = {
    holderName: "Example User",
    ifsc: "ABCD0123456",
    accountNumber: "123456789012",
    phonePay: "",
    googlePay: "9876543210"
  };

  assert.equal(await context.saveWithdrawalDetails({ values: details }), true);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].path, "DATA/1234567890/AD");
  assert.deepEqual(JSON.parse(JSON.stringify(writes[0].value)), details);
  assert.deepEqual(JSON.parse(storage.get("dpboss60Withdrawal:1234567890")), {
    ...details,
    amount: "250"
  });
});

test("withdraw page restores account details from Firebase into local storage", async () => {
  const storage = new Map();
  const accountDetails = {
    holderName: "Example User",
    ifsc: "ABCD0123456",
    accountNumber: "123456789012",
    phonePay: "",
    googlePay: "9876543210"
  };
  const context = {
    state: { user: { phone: "1234567890" } },
    DATABASE_ROOTS: { users: "DATA" },
    phonePath: phone => encodeURIComponent(phone),
    decodeFirebaseValue: value => value,
    localStorage: {
      getItem: key => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value)
    },
    sessionStorage: { getItem: () => null },
    notify: () => {},
    dbGet: async path => {
      assert.equal(path, "DATA/1234567890/AD");
      return accountDetails;
    },
    dbPutAndVerify: async () => assert.fail("Existing Firebase details should not be overwritten")
  };
  vm.runInNewContext(
    `${withdrawalDetailsSource}\nglobalThis.loadWithdrawalDetailsFromAccount = loadWithdrawalDetailsFromAccount;\nglobalThis.savedWithdrawalDetails = savedWithdrawalDetails;`,
    context
  );

  await context.loadWithdrawalDetailsFromAccount();
  assert.deepEqual(JSON.parse(storage.get("dpboss60Withdrawal:1234567890")), {
    ...accountDetails,
    amount: ""
  });
});
