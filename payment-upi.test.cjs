const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "site-app.webjs"), "utf8");
const start = source.indexOf("function createRandomUpiTxnId() {");
const end = source.indexOf("\nasync function startPayment(event)", start);
assert.notEqual(start, -1, "Missing direct UPI payment functions");
assert.notEqual(end, -1, "Missing end marker for direct UPI payment functions");
const paymentSource = source.slice(start, end);

test("direct Paytm UPI launch retains the generated transaction reference", async () => {
  const messages = [];
  const context = {
    state: {
      user: { phone: "9876543210" },
      paymentMinimumDeposit: 1,
      paymentUpiTemplate: "upi://pay?pa=merchant%40paytm&pn=Merchant&am=###&cu=INR",
      directPaymentReference: "stale-reference"
    },
    Date,
    Math,
    Uint32Array,
    URL,
    URLSearchParams,
    FormData: class {
      get() { return "250.50"; }
    },
    window: {
      crypto: { getRandomValues: values => values.fill(7) },
      ReactNativeWebView: { postMessage: value => messages.push(JSON.parse(value)) }
    },
    paymentHostMessage: message => messages.push(message),
    setBusy: () => {},
    notify: () => {},
    renderPage: async () => {}
  };
  vm.runInNewContext(
    `${paymentSource}\nglobalThis.startDirectPayment = startDirectPayment;`,
    context
  );
  const event = {
    preventDefault() {},
    target: { querySelector: () => ({}) }
  };

  await context.startDirectPayment(event);

  assert.equal(messages.length, 1);
  assert.equal(messages[0].type, "open-upi-payment");
  const paymentUrl = new URL(messages[0].upiUrl);
  assert.equal(paymentUrl.protocol, "upi:");
  assert.equal(paymentUrl.hostname, "pay");
  assert.equal(paymentUrl.searchParams.get("pa"), "merchant@paytm");
  assert.equal(paymentUrl.searchParams.get("am"), "250.50");
  assert.equal(paymentUrl.searchParams.get("cu"), "INR");
  assert.equal(paymentUrl.searchParams.get("tr"), context.state.directPaymentReference);
  assert.notEqual(paymentUrl.searchParams.get("tr"), "stale-reference");
});
