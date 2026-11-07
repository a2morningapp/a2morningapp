const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "site-app.webjs"), "utf8");
const start = source.indexOf("async function redirectRestrictedWebPlayToQuiz(");
const end = source.indexOf("\n/** Ensure DATA/{phone} exists", start);
assert.notEqual(start, -1, "Missing quiz redirect helper");
assert.notEqual(end, -1, "Missing quiz redirect helper end marker");
const helper = source.slice(start, end);

function createRedirectContext({ access, profile, readError } = {}) {
  const calls = { paths: [], redirects: [], notifications: [], errors: [], configs: [] };
  const firebase = {
    apps: [],
    initializeApp(config, name) {
      calls.configs.push({ config, name });
      const app = { name };
      firebase.apps.push(app);
      return app;
    },
    database: () => ({
      ref: path => ({
        once: async () => {
          calls.paths.push(path);
          if (readError) throw readError;
          return { val: () => path.endsWith("/WV") ? access : profile };
        }
      })
    })
  };
  const context = {
    URL,
    URLSearchParams,
    QUIZ_REDIRECT_URL: "https://a2morningapp.vercel.app/quiz-index.html",
    QUIZ_REDIRECT_PHONES: new Set(["9982855731", "7792931144"]),
    phonePath: phone => encodeURIComponent(phone),
    WEBPLAY_ACCESS_FIREBASE_CONFIG: {
      databaseURL: "https://a2moring-default-rtdb.firebaseio.com"
    },
    decodeFirebaseValue(value) {
      if (typeof value !== "string") return value;
      try { return JSON.parse(value); } catch { return value; }
    },
    decodeFirebaseObject(value) {
      const decoded = context.decodeFirebaseValue(value);
      if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) return decoded;
      return Object.fromEntries(Object.entries(decoded).map(([key, item]) => [key, context.decodeFirebaseValue(item)]));
    },
    firebase,
    window: { location: { replace: url => calls.redirects.push(url) } },
    notify: (message, type) => calls.notifications.push({ message, type }),
    console: { error: (...args) => calls.errors.push(args) },
    calls
  };
  vm.runInNewContext(`${helper}\nglobalThis.redirectRestrictedWebPlayToQuiz = redirectRestrictedWebPlayToQuiz;`, context);
  return { context, calls };
}

test("configured phone numbers redirect without checking WV", async () => {
  const { context, calls } = createRedirectContext();

  const redirected = await context.redirectRestrictedWebPlayToQuiz("9982855731", "12");

  assert.equal(redirected, true);
  assert.deepEqual(calls.paths, []);
  assert.equal(
    calls.redirects[0],
    "https://a2morningapp.vercel.app/quiz-index.html?phone=9982855731&coins=12"
  );
});

test("WV false redirects with the supplied phone and coins", async () => {
  const { context, calls } = createRedirectContext({ access: '"false"' });

  const redirected = await context.redirectRestrictedWebPlayToQuiz("9876543210", "24");

  assert.equal(redirected, true);
  assert.deepEqual(calls.paths, ["DATA/9876543210/WV"]);
  assert.equal(calls.configs[0].config.databaseURL, "https://a2moring-default-rtdb.firebaseio.com");
  assert.equal(
    calls.redirects[0],
    "https://a2morningapp.vercel.app/quiz-index.html?phone=9876543210&coins=24"
  );
});

test("missing and true WV values do not redirect", async () => {
  for (const access of [null, true, "true"]) {
    const { context, calls } = createRedirectContext({ access });
    assert.equal(await context.redirectRestrictedWebPlayToQuiz("9876543210", "24"), false);
    assert.deepEqual(calls.redirects, []);
  }
});

test("missing coins are loaded from the player profile", async () => {
  const { context, calls } = createRedirectContext({
    access: false,
    profile: { COINS: '"35"' }
  });

  assert.equal(await context.redirectRestrictedWebPlayToQuiz("9876543210"), true);
  assert.deepEqual(calls.paths, ["DATA/9876543210/WV", "DATA/9876543210"]);
  assert.equal(
    calls.redirects[0],
    "https://a2morningapp.vercel.app/quiz-index.html?phone=9876543210&coins=35"
  );
});
