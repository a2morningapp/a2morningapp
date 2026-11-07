const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const adminPath = path.join(__dirname, "admin.js");
const adminSource = fs.readFileSync(adminPath, "utf8");
const phpSource = fs.readFileSync(path.join(__dirname, "onesignal.php"), "utf8");
const workflowSource = fs.readFileSync(
  path.join(__dirname, "..", ".github", "workflows", "deploy-admin.yml"),
  "utf8"
);
const gitignore = fs.readFileSync(path.join(__dirname, ".gitignore"), "utf8");

function extract(start, end) {
  const startIndex = adminSource.indexOf(start);
  const endIndex = adminSource.indexOf(end, startIndex);
  assert.notEqual(startIndex, -1, `Missing source marker: ${start}`);
  assert.notEqual(endIndex, -1, `Missing source marker: ${end}`);
  return adminSource.slice(startIndex, endIndex);
}

test("admin sends broadcast and targeted notifications through PHP", async () => {
  const calls = [];
  const functionSource = [
    extract("async function onesignalBroadcast(", "const ADMIN_SESSION_KEY"),
    extract("async function requestBroadcast(", "\nfunction requestPath(request)")
  ].join("\n");
  const context = {
    BROADCAST_ENDPOINT: "https://admin.example.com/onesignal.php",
    fetch: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, recipients: 3, notificationId: "notification-id" })
      };
    }
  };
  vm.runInNewContext(`${functionSource}\nglobalThis.senders = { onesignalBroadcast, onesignalToPlayerIds };`, context);

  const broadcast = await context.senders.onesignalBroadcast("Title", "Body");
  const targeted = await context.senders.onesignalToPlayerIds(["subscription-id"], "Private title", "Private body");

  assert.equal(calls.length, 2);
  assert.ok(calls.every(call => call.url === "https://admin.example.com/onesignal.php"));
  assert.ok(calls.every(call => call.options.credentials === "same-origin"));
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    action: "send",
    heading: "Title",
    message: "Body",
    data: {}
  });
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    action: "send",
    heading: "Private title",
    message: "Private body",
    subscriptionId: "subscription-id",
    data: {}
  });
  assert.equal(broadcast.recipients, 3);
  assert.equal(targeted.recipients, 3);
});

test("OneSignal REST key is not embedded in browser JavaScript", () => {
  assert.doesNotMatch(adminSource, /ONESIGNAL_REST_API_KEY\s*=/);
  assert.doesNotMatch(adminSource, /Authorization\s*:\s*`Key\s*\$\{/);
  assert.doesNotMatch(adminSource, /https:\/\/api\.onesignal\.com\/notifications/);
  assert.match(phpSource, /getenv\('ONESIGNAL_REST_API_KEY'\)/);
});

test("GitHub deployment generates an ignored server-only key file", () => {
  assert.match(workflowSource, /secrets\.ONESIGNAL_REST_API_KEY/);
  assert.match(workflowSource, /onesignal-secret\.php/);
  assert.match(workflowSource, /SCRIPT_FILENAME/);
  assert.match(workflowSource, /SamKirkland\/FTP-Deploy-Action/);
  assert.match(gitignore, /^onesignal-secret\.php$/m);
});
