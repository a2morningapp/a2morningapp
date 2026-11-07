const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "site-app.webjs"), "utf8");
const start = source.indexOf("function paymentApiRequest(parameters) {");
const end = source.indexOf("\nfunction openPaymentViewer", start);
assert.notEqual(start, -1, "Missing paymentApiRequest");
assert.notEqual(end, -1, "Missing end marker for paymentApiRequest");
const requestSource = source.slice(start, end);

function createRequest(url) {
  const appendedScripts = [];
  const window = {
    setTimeout: () => 1,
    clearTimeout: () => {}
  };
  const context = {
    state: { paymentApiUrl: url },
    window,
    document: {
      createElement: () => ({ remove() {} }),
      head: { append: script => appendedScripts.push(script) }
    },
    URL,
    URLSearchParams,
    Date,
    Math
  };
  vm.runInNewContext(`${requestSource}\nglobalThis.request = paymentApiRequest;`, context);
  return { request: context.request, window, appendedScripts };
}

test("accepts the configured A2Morning PHP payment endpoint", async () => {
  const { request, window, appendedScripts } = createRequest(
    "https://a2morning.mama567.bond/a2-payment-api.php"
  );
  const resultPromise = request({ action: "create-order" });
  assert.equal(appendedScripts.length, 1);
  const requestUrl = new URL(appendedScripts[0].src);
  assert.equal(requestUrl.pathname, "/a2-payment-api.php");
  assert.equal(requestUrl.searchParams.get("action"), "create-order");
  const callback = requestUrl.searchParams.get("callback");
  window[callback]({ ok: true, orderId: "test-order" });
  assert.deepEqual(await resultPromise, { ok: true, orderId: "test-order" });
});

test("keeps accepting the standard PHP payment endpoint", async () => {
  const { request, window, appendedScripts } = createRequest(
    "https://payments.example.com/payment-api.php"
  );
  const resultPromise = request({ action: "status" });
  const callback = new URL(appendedScripts[0].src).searchParams.get("callback");
  window[callback]({ ok: true });
  assert.deepEqual(await resultPromise, { ok: true });
});

test("rejects unsupported, insecure, or preconfigured PHP URLs", async () => {
  for (const url of [
    "https://payments.example.com/other.php",
    "http://a2morning.mama567.bond/a2-payment-api.php",
    "https://a2morning.mama567.bond/a2-payment-api.php?key=value"
  ]) {
    const { request } = createRequest(url);
    await assert.rejects(request({ action: "status" }), /configured payment service URL is invalid/i);
  }
});
