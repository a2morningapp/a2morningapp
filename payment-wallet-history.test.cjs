const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "site-app.webjs"), "utf8");

function extract(start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex);
  assert.notEqual(startIndex, -1, `Missing source marker: ${start}`);
  assert.notEqual(endIndex, -1, `Missing source marker: ${end}`);
  return source.slice(startIndex, endIndex);
}

const walletHistorySource = [
  extract("function updatePointsHistory() {", "\nasync function loadWalletRequests"),
  extract("function requestRecordsForPhone(data, phone, kind) {", "\nasync function loadGlobalData")
].join("\n");
const paymentPollingSource = extract(
  "function startPaymentStatusPolling(order, checkoutOpened) {",
  "\nfunction comparableFirebaseValue"
);
const paymentCountdownSource = extract(
  "function paymentRetrySeconds(order) {",
  "\nfunction clearPendingPayment"
);

test("points history recognizes approved gateway deposit records", () => {
  const state = {
    bids: [],
    depositHistory: [],
    withdrawalHistory: [],
    accountTransactions: [],
    demoTransactions: [],
    pointsHistory: []
  };
  const context = {
    state,
    decodeFirebaseObject: value => value,
    decodeFirebaseValue: value => value
  };
  vm.runInNewContext(
    `${walletHistorySource}\nglobalThis.requestRecordsForPhone = requestRecordsForPhone;\nglobalThis.updatePointsHistory = updatePointsHistory;`,
    context
  );

  const gatewayOrderId = "1794073709776698885";
  const gatewayKey = `GW-${gatewayOrderId}-9789789789`;
  state.depositHistory = context.requestRecordsForPhone({
    [gatewayKey]: [
      "9789789789",
      "HappySatta Gateway",
      "6aef646dc5a7d",
      1,
      100,
      `Gateway deposit ${gatewayOrderId}`,
      "Approved"
    ]
  }, "9789789789", "deposit");
  state.accountTransactions = [{
    id: `TX-GW-${gatewayOrderId}`,
    type: "Added",
    amount: 1,
    method: "HappySatta",
    note: `Gateway deposit · ${gatewayOrderId}`
  }];
  context.updatePointsHistory();

  assert.equal(state.depositHistory.length, 1);
  assert.equal(state.depositHistory[0].status, "Approved");
  assert.equal(state.depositHistory[0].gatewayOrderId, gatewayOrderId);
  assert.equal(state.depositHistory[0].reference, "6aef646dc5a7d");
  assert.equal(state.pointsHistory.length, 1);
  assert.equal(state.pointsHistory[0].title, "Gateway deposit");
});

test("points history continues recognizing ordinary deposit and withdrawal entries", () => {
  const context = {
    decodeFirebaseObject: value => value,
    decodeFirebaseValue: value => value
  };
  vm.runInNewContext(
    `${walletHistorySource}\nglobalThis.requestRecordsForPhone = requestRecordsForPhone;`,
    context
  );
  const deposits = context.requestRecordsForPhone({
    "2026-11-07 20:00:00 9789789789": JSON.stringify([
      "9789789789", "UPI Direct", "UPIREF123", 500, 100, "", "Pending"
    ])
  }, "9789789789", "deposit");
  const withdrawals = context.requestRecordsForPhone({
    "2026-11-07 20:00:00 9789789789": JSON.stringify([
      "9789789789", "", "1234567890", "", "", "", "", 200, 400, "Pending"
    ])
  }, "9789789789", "withdrawal");

  assert.equal(deposits.length, 1);
  assert.equal(deposits[0].status, "Pending");
  assert.equal(withdrawals.length, 1);
  assert.equal(withdrawals[0].status, "Pending");
});

test("confirmed gateway payment refreshes balance and Points history", async () => {
  const calls = [];
  const timers = [];
  const context = {
    activePaymentChecks: new Map(),
    state: { user: { phone: "9789789789" } },
    Date,
    paymentApiRequest: async () => ({
      status: "COMPLETED",
      credited: true,
      amount: 1
    }),
    clearPendingPayment: () => calls.push("clear-pending"),
    closePaymentViewer: () => {},
    refreshUserData: async () => calls.push("refresh-balance"),
    loadWalletRequests: async page => calls.push(`load-wallet-${page}`),
    renderPage: async () => calls.push("render"),
    money: amount => `₹ ${amount}`,
    notify: message => calls.push(message),
    savePendingPayment: () => assert.fail("A credited order should not remain pending."),
    window: {
      setTimeout: callback => {
        timers.push(callback);
        return timers.length;
      },
      clearTimeout: () => {}
    }
  };
  vm.runInNewContext(
    `${paymentPollingSource}\nglobalThis.startPaymentStatusPolling = startPaymentStatusPolling;`,
    context
  );
  const order = {
    phone: "9789789789",
    orderId: "1794073709776698885",
    pollToken: "test-token"
  };

  context.startPaymentStatusPolling(order, false);
  const check = context.activePaymentChecks.get(order.orderId);
  await check.poll();

  assert.ok(calls.includes("refresh-balance"));
  assert.ok(calls.includes("load-wallet-points"));
  assert.ok(calls.includes("render"));
  assert.equal(context.activePaymentChecks.has(order.orderId), false);
});

for (const status of ["FAILED", "CANCELLED"]) {
  test(`${status.toLowerCase()} gateway payment clears its pending card and refreshes the deposit page`, async () => {
    const calls = [];
    const context = {
      activePaymentChecks: new Map(),
      state: { user: { phone: "9789789789" } },
      Date,
      paymentApiRequest: async () => ({ status, credited: false }),
      clearPendingPayment: order => calls.push(`clear-${order.orderId}`),
      closePaymentViewer: () => calls.push("close-checkout"),
      renderPage: async () => calls.push("render"),
      notify: message => calls.push(message),
      savePendingPayment: () => assert.fail("A failed or cancelled order must not remain pending."),
      window: { setTimeout: () => 1, clearTimeout: () => {} }
    };
    vm.runInNewContext(
      `${paymentPollingSource}\nglobalThis.startPaymentStatusPolling = startPaymentStatusPolling;`,
      context
    );
    const order = {
      phone: "9789789789",
      orderId: `failed-${status.toLowerCase()}`,
      pollToken: "test-token"
    };

    context.startPaymentStatusPolling(order, false);
    await context.activePaymentChecks.get(order.orderId).poll();

    assert.ok(calls.includes(`clear-${order.orderId}`));
    assert.ok(calls.includes("render"));
    assert.ok(calls.some(message => String(message).includes("failed or was cancelled")));
    assert.equal(context.activePaymentChecks.has(order.orderId), false);
  });
}

test("pending checkout countdown closes its card and unlocks the payment form after five seconds", () => {
  const controls = [{ disabled: true }, { disabled: true }];
  const card = { style: { display: "" } };
  const countdown = {
    dataset: { createdAt: new Date(Date.now() - 6000).toISOString() },
    closest: selector => selector === ".payment-pending-card" ? card : null,
    textContent: ""
  };
  const context = {
    Date,
    queryAll: selector => selector === "[data-payment-retry-countdown]" ? [countdown]
      : selector.startsWith("#deposit-form") ? controls : [],
    query: selector => selector === "#deposit-form" ? {} : null
  };
  vm.runInNewContext(
    `${paymentCountdownSource}\nglobalThis.updatePaymentRetryCountdown = updatePaymentRetryCountdown;`,
    context
  );
  context.updatePaymentRetryCountdown();

  assert.equal(card.style.display, "none");
  assert.equal(countdown.textContent, "Ready");
  assert.deepEqual(controls.map(control => control.disabled), [false, false]);
});
