const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "site-app.webjs"), "utf8");
const walletStart = source.indexOf("function walletCoinsValue(profile) {");
const walletEnd = source.indexOf("\nasync function ensureUserBalance", walletStart);
const ensureStart = walletEnd + 1;
const ensureEnd = source.indexOf("\nasync function changePassword", ensureStart);
const start = source.indexOf("async function refreshUserData() {");
const end = source.indexOf("\nfunction normalizeAccountTransactions", start);
assert.notEqual(walletStart, -1, "Missing walletCoinsValue");
assert.notEqual(walletEnd, -1, "Missing end marker for walletCoinsValue");
assert.notEqual(ensureEnd, -1, "Missing end marker for ensureUserBalance");
assert.notEqual(start, -1, "Missing refreshUserData");
assert.notEqual(end, -1, "Missing end marker for refreshUserData");
const walletSource = source.slice(walletStart, walletEnd);
const ensureSource = source.slice(ensureStart, ensureEnd);
const refreshSource = source.slice(start, end);

test("wallet refresh uses the fresh profile balance after a confirmed payment", async () => {
  const state = {
    user: { phone: "1234567890", name: "Player" },
    balance: 100,
    balancePath: "",
    demoBalance: 0,
    demoTransactions: [],
    bids: [],
    accountTransactions: [],
    pointsHistory: []
  };
  const reads = [];
  const context = {
    state,
    DATABASE_ROOTS: {
      users: "DATA",
      bidHistory: "Normal T Data2",
      bidRecords: "Normal T Data"
    },
    phonePath: value => encodeURIComponent(value),
    decodeFirebaseObject: value => value,
    decodeFirebaseValue: value => value,
    dbGet: async path => {
      reads.push(path);
      if (path === "DATA/1234567890") return { name: "Player", COINS: "275", bal: "999" };
      return null;
    },
    ensureUserBalance: async () => {
      throw new Error("Should not read the balance from the potentially stale SDK cache.");
    },
    normalizeDemoTransactions: () => [],
    userHistoryRecords: () => [],
    normalizeAccountTransactions: () => [],
    updatePointsHistory: () => {}
  };

  vm.runInNewContext(
    `${walletSource}\n${refreshSource}\nglobalThis.refreshUserData = refreshUserData;`,
    context
  );
  await context.refreshUserData();

  assert.equal(state.balance, 275);
  assert.equal(state.balancePath, "DATA/1234567890/COINS");
  assert.deepEqual(reads, [
    "DATA/1234567890",
    "Normal T Data2/1234567890",
    "Normal T Data/1234567890",
    "DATA/1234567890/transactions"
  ]);
});

test("wallet refresh migrates a legacy balance into COINS when COINS is absent", async () => {
  const state = {
    user: { phone: "1234567890", name: "Player" },
    balance: 0,
    balancePath: "",
    demoBalance: 0,
    demoTransactions: [],
    bids: [],
    accountTransactions: [],
    pointsHistory: []
  };
  const context = {
    state,
    DATABASE_ROOTS: {
      users: "DATA",
      bidHistory: "Normal T Data2",
      bidRecords: "Normal T Data"
    },
    phonePath: value => encodeURIComponent(value),
    decodeFirebaseObject: value => value,
    decodeFirebaseValue: value => value,
    dbGet: async path => path === "DATA/1234567890" ? { name: "Player", bal: "40" } : null,
    ensureUserBalance: async (profilePath, profile) => {
      assert.equal(profilePath, "DATA/1234567890");
      assert.equal(profile.bal, "40");
      return 40;
    },
    normalizeDemoTransactions: () => [],
    userHistoryRecords: () => [],
    normalizeAccountTransactions: () => [],
    updatePointsHistory: () => {}
  };

  vm.runInNewContext(
    `${walletSource}\n${refreshSource}\nglobalThis.refreshUserData = refreshUserData;`,
    context
  );
  await context.refreshUserData();

  assert.equal(state.balance, 40);
  assert.equal(state.balancePath, "DATA/1234567890/COINS");
});

test("balance initialization copies the legacy value once without replacing an existing COINS value", async () => {
  let storedCoins = null;
  const database = {
    ref: path => {
      assert.equal(path, "DATA/1234567890/COINS");
      return {
        once: async () => ({
          exists: () => storedCoins !== null,
          val: () => storedCoins
        }),
        transaction: async update => {
          const nextValue = update(storedCoins);
          const committed = nextValue !== undefined;
          if (committed) storedCoins = nextValue;
          return { committed, snapshot: { val: () => storedCoins } };
        }
      };
    }
  };
  const context = {
    window: { firebase: { database: () => database } },
    firebase: { database: () => database },
    decodeFirebaseValue: value => value,
    configuredSignUpBonus: async () => 10
  };
  vm.runInNewContext(
    `${walletSource}\n${ensureSource}\nglobalThis.ensureUserBalance = ensureUserBalance;`,
    context
  );

  const migrated = await context.ensureUserBalance("DATA/1234567890", { COINS: null, bal: "40" });
  assert.equal(migrated, 40);
  assert.equal(storedCoins, 40);

  storedCoins = 75;
  const preserved = await context.ensureUserBalance("DATA/1234567890", { COINS: 75, bal: "900" });
  assert.equal(preserved, 75);
  assert.equal(storedCoins, 75);
});
