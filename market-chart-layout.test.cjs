const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "site-app.webjs"), "utf8");
const styles = fs.readFileSync(path.join(__dirname, "sridevi-matka-theme.css"), "utf8");

function extract(start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex);
  assert.notEqual(startIndex, -1, `Missing source marker: ${start}`);
  assert.notEqual(endIndex, -1, `Missing source marker: ${end}`);
  return source.slice(startIndex, endIndex);
}

test("panel chart explains Firebase read permission failures", async () => {
  const notifications = [];
  const state = {
    page: "panel-chart",
    selectedPanelMarket: "Market A",
    panelResults: {},
    panelResultsLoading: false,
    panelResultsError: ""
  };
  const context = {
    state,
    EXPERT_GUESSING_DATABASE_URL: "https://example.firebaseio.com",
    dbKey: value => String(value).replace(/[.#$\[\]/]/g, "_"),
    fetch: async () => ({ ok: false, status: 401 }),
    renderPage: async () => {},
    notify: (message, type) => notifications.push({ message, type })
  };
  vm.runInNewContext(
    `${extract("async function loadPanelChartResults(marketName) {", "\nfunction openExternalUrl")}\nglobalThis.loadPanelChartResults = loadPanelChartResults;`,
    context
  );

  await context.loadPanelChartResults("Market A");

  assert.match(state.panelResultsError, /denied read access.*HTTP 401/i);
  assert.match(state.panelResultsError, /\/results\/Market A/);
  assert.equal(notifications.length, 1);
});

test("mobile timetable keeps open and close columns visible", () => {
  const state = {
    markets: [{
      name: "Market A",
      position: 1,
      openTime: "10:00",
      closeTime: "18:30"
    }]
  };
  const context = {
    state,
    displayMarketTime: value => value === "10:00" ? "10:00 AM" : "06:30 PM",
    safeText: value => String(value)
  };
  vm.runInNewContext(
    `${extract("function renderTimeTable() {", "\nfunction dbKey(value)")}\nglobalThis.renderTimeTable = renderTimeTable;`,
    context
  );

  const markup = context.renderTimeTable();
  assert.match(markup, /<th>Close<br>Time<\/th>/);
  assert.match(markup, /06:30 PM/);
  assert.match(styles, /\.non-home-page \.time-table-scroll table\s*\{[^}]*min-width:\s*0[^}]*table-layout:\s*fixed/s);
  assert.match(styles, /\.non-home-page \.time-table-scroll thead th:nth-child\(3\)\s*\{?[^}]*width:\s*28%/s);
});

test("market chart headers give titles the available width", () => {
  assert.match(styles, /\.chart-market-page > header\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(styles, /\.panel-chart-page > header\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+44px/);
  assert.match(styles, /\.panel-chart-page > header h1\s*\{[^}]*font-size:\s*clamp\(16px,\s*4vw,\s*20px\)/s);
});
