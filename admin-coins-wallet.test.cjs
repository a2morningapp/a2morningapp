const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.join(__dirname, "A2Morning Matka Admin", "admin.js"),
  "utf8"
);
const start = source.indexOf("async function adjustRequestBalanceOnce(request, target, operation, delta) {");
const end = source.indexOf("\nasync function resolvePaymentRequest", start);
assert.notEqual(start, -1, "Missing adjustRequestBalanceOnce");
assert.notEqual(end, -1, "Missing end marker for adjustRequestBalanceOnce");
const adjustmentSource = source.slice(start, end);

function createContext(initialProfile) {
  let profile = structuredClone(initialProfile);
  const context = {
    databaseRootRef: {
      child: path => {
        assert.equal(path, "DATA/1234567890");
        return {
          transaction: async update => {
            const nextProfile = update(structuredClone(profile));
            const committed = nextProfile !== undefined;
            if (committed) profile = nextProfile;
            return { committed, snapshot: { val: () => structuredClone(profile) } };
          }
        };
      }
    },
    decodeLegacyValue: value => value,
    numberFromLegacy: value => Number(value || 0),
    safeMarkerKey: value => String(value).replace(/[^A-Za-z0-9_-]/g, "_"),
    lastSyncedData: null
  };
  vm.runInNewContext(
    `${adjustmentSource}\nglobalThis.adjustRequestBalanceOnce = adjustRequestBalanceOnce;`,
    context
  );
  return { context, getProfile: () => profile };
}

test("admin wallet adjustments migrate legacy balances to COINS and remain idempotent", async () => {
  const { context, getProfile } = createContext({ bal: "50", TD: "0" });
  const target = { mobile: "1234567890", balance: 50 };
  const request = { id: "DR-request-1", amount: 10 };

  const first = await context.adjustRequestBalanceOnce(request, target, "deposit", 10);
  const retry = await context.adjustRequestBalanceOnce(request, target, "deposit", 10);

  assert.equal(first.alreadyApplied, false);
  assert.equal(retry.alreadyApplied, true);
  assert.equal(target.balanceField, "COINS");
  assert.equal(target.balance, 60);
  assert.equal(getProfile().COINS, 60);
  assert.equal(getProfile().bal, "50");
  assert.equal(getProfile().TD, 10);
});

test("admin wallet adjustments prefer COINS over a conflicting legacy balance", async () => {
  const { context, getProfile } = createContext({ COINS: 20, bal: "900", TD: "0" });
  const target = { mobile: "1234567890", balance: 20 };

  await context.adjustRequestBalanceOnce(
    { id: "DR-request-2", amount: 5 },
    target,
    "deposit",
    5
  );

  assert.equal(target.balance, 25);
  assert.equal(getProfile().COINS, 25);
  assert.equal(getProfile().bal, "900");
});
