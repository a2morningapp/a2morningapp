const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const websiteSource = fs.readFileSync(path.join(__dirname, "site-app.webjs"), "utf8");
const websiteStylesSource = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
const deployedWebsiteSource = fs.readFileSync(
  path.join(__dirname, "..", "WebPlay", "WebPlay", "web-app.js"),
  "utf8"
);
const adminSource = fs.readFileSync(
  path.join(__dirname, "A2Morning Matka Admin", "admin.js"),
  "utf8"
);

function extract(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(start, -1, `Missing ${startMarker}`);
  assert.notEqual(end, -1, `Missing ${endMarker}`);
  return source.slice(start, end);
}

const websiteMarketSource = extract(
  websiteSource,
  "function normalizeMarkets(bucket) {",
  "\nfunction setPage"
);
const deployedWebsiteMarketSource = extract(
  deployedWebsiteSource,
  "function normalizeMarkets(bucket) {",
  "\nfunction setPage"
);
const adminMarketSource = extract(
  adminSource,
  "function marketTypeFromName(name) {",
  "\nfunction marketTimeInput"
);
const adminPersistenceSource = extract(
  adminSource,
  "function legacyUpdatesFor(changed, previous) {",
  "\nfunction persist"
);
const adminResultFormatSource = extract(
  adminSource,
  "function marketResultFormat(market) {",
  "\nfunction normalizedResultSession"
);
const siteChartResultSource = extract(
  websiteSource,
  "function panelChartResultParts(record, category = \"\") {",
  "\nfunction renderPanelChart"
);

test("website honors the admin market category and falls back for older market records", () => {
  const context = {
    decodeFirebaseValue(value) {
      let decoded = value;
      for (let depth = 0; depth < 2 && typeof decoded === "string"; depth += 1) {
        try {
          decoded = JSON.parse(decoded);
        } catch {
          break;
        }
      }
      return decoded;
    }
  };
  vm.runInNewContext(
    `${websiteMarketSource}\nglobalThis.normalizeMarkets = normalizeMarkets;`,
    context
  );

  const markets = context.normalizeMarkets({
    one: ["Starline Lucky", "", "", "", "", "Running", "### - ## - ###", "1",
      JSON.stringify({ category: "Main market" })],
    two: ["Regular Evening", "", "", "", "", "Running", "### - ## - ###", "2",
      JSON.stringify({ category: "Gali / Disawar" })],
    three: ["Starline Old Market", "", "", "", "", "Running", "### - ## - ###", "3"]
  });

  assert.deepEqual(
    JSON.parse(JSON.stringify(markets.map(market => market.category))),
    ["Main", "Gali / Disawar", "Starline"]
  );

  const updatedDuplicate = context.normalizeMarkets({
    older: ["Regular Evening", "", "", "", "", "Running", "### - ## - ###", "2",
      JSON.stringify({ category: "Main market", categoryUpdatedAt: "2026-11-12T10:00:00.000Z" })],
    newer: ["Regular Evening", "", "", "", "", "Running", "### - ## - ###", "2",
      JSON.stringify({ category: "Gali / Disawar", categoryUpdatedAt: "2026-11-13T10:00:00.000Z" })]
  });
  assert.equal(updatedDuplicate.length, 1);
  assert.equal(updatedDuplicate[0].category, "Gali / Disawar");
});

test("deployed website uses the saved Kalyan Morning category", () => {
  const context = {
    decodeFirebaseValue(value) {
      let decoded = value;
      for (let depth = 0; depth < 2 && typeof decoded === "string"; depth += 1) {
        try {
          decoded = JSON.parse(decoded);
        } catch {
          break;
        }
      }
      return decoded;
    }
  };
  vm.runInNewContext(
    `${deployedWebsiteMarketSource}\nglobalThis.normalizeMarkets = normalizeMarkets;`,
    context
  );

  const markets = context.normalizeMarkets({
    6: ["KALYAN MORNING", "11:40:00 AM", "12:40:00 PM", "Y", "Y", "Stop",
      "### - ## - ###", "1",
      JSON.stringify({ category: "Gali / Disawar", days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] })],
    27: ["GALI", "11:30:00 PM", "11:30:00 PM", "Y", "Y", "Running",
      "### - ## - ###", "2"]
  });

  assert.deepEqual(
    JSON.parse(JSON.stringify(markets.map(market => [market.name, market.category]))),
    [["KALYAN MORNING", "Gali / Disawar"], ["GALI", "Gali / Disawar"]]
  );
});

test("admin recognizes the three explicit market categories and keeps legacy name fallback", () => {
  const context = {
    normalizedMarketDays: value => value || [],
    legacyMarketTime: value => value || "",
    marketResultFormat: market => market.type === "Starline" ? "starline" : "main",
    marketResultForDisplay: (market, value) => market.type === "Starline" ? "### - #" : value
  };
  vm.runInNewContext(
    `${adminMarketSource}\nglobalThis.normalizeMarketType = normalizeMarketType;\nglobalThis.updateMarketCategory = updateMarketCategory;`,
    context
  );

  assert.equal(context.normalizeMarketType("Starline", "Market A"), "Starline");
  assert.equal(context.normalizeMarketType("Gali / Disawar", "Market A"), "Gali / Disawar");
  assert.equal(context.normalizeMarketType("Main market", "Market A"), "Main market");
  assert.equal(context.normalizeMarketType("", "Starline Old Market"), "Starline");

  const market = {
    id: "market-1",
    name: "Regular market",
    type: "Main market",
    days: ["Monday"],
    open: "10:00",
    close: "11:00",
    status: "Open",
    position: 1,
    resultDate: "2026-11-13",
    websiteVisible: true,
    legacyFields: ["Regular market", "", "", "Y", "Y", "Running", "###", "1",
      JSON.stringify({ customSetting: true, websiteVisible: true })]
  };
  assert.equal(context.updateMarketCategory(market, "Starline"), "Starline");
  assert.equal(market.type, "Starline");
  assert.deepEqual(
    JSON.parse(market.legacyFields[8]),
    {
      customSetting: true,
      websiteVisible: true,
      id: "market-1",
      days: ["Monday"],
      resultDate: "2026-11-13",
      category: "Starline",
      categoryUpdatedAt: market.categoryUpdatedAt,
      resultFormat: "starline"
    }
  );
  assert.equal(market.legacyFields[6], "### - #");
  assert.match(adminSource, /data-market-category/);
  assert.match(adminSource, /name="category"/);
});

test("admin persists category metadata to the Firebase market record the website reads", () => {
  const context = {
    marketLegacyEntries: market => market.legacyEntries,
    normalizedMarketDays: value => value || [],
    legacyMarketTime: value => value || "",
    normalizeMarketType: value => value,
    marketResultFormat: market => /gali|disawar/i.test(market.type) ? "gali"
      : /starline/i.test(market.type) ? "starline" : "main",
    marketResultForDisplay: (market, value) => /gali|disawar/i.test(market.type)
      ? /^\d{2}$/.test(String(value || "")) ? String(value) : "##" : value
  };
  vm.runInNewContext(
    `${adminPersistenceSource}\nglobalThis.legacyUpdatesFor = legacyUpdatesFor;`,
    context
  );
  const previous = {
    settings: {},
    markets: [{
      id: "market-1",
      name: "Regular market",
      type: "Main market",
      days: ["Monday"],
      legacyEntries: { GAMES: "1" },
      legacyFields: ["Regular market", "10:00 AM", "11:00 AM", "Y", "Y", "Running", "###", "1",
        JSON.stringify({ id: "market-1", category: "Main market" })]
    }]
  };
  const changedMarket = {
    ...previous.markets[0],
    type: "Gali / Disawar",
    categoryUpdatedAt: "2026-11-13T10:00:00.000Z",
    legacyFields: ["Regular market", "10:00 AM", "11:00 AM", "Y", "Y", "Running", "###", "1",
      JSON.stringify({
        id: "market-1",
        days: ["Monday"],
        category: "Gali / Disawar",
        categoryUpdatedAt: "2026-11-13T10:00:00.000Z"
      })]
  };
  const updates = context.legacyUpdatesFor({ markets: [changedMarket] }, previous);
  const persistedFields = JSON.parse(updates["GAMES/1"]);
  const persistedMetadata = JSON.parse(persistedFields[8]);
  assert.equal(persistedMetadata.category, "Gali / Disawar");
  assert.equal(persistedMetadata.categoryUpdatedAt, "2026-11-13T10:00:00.000Z");
  assert.equal(persistedFields[6], "##");
  assert.equal(persistedMetadata.resultFormat, "gali");
});

test("admin formats legacy results by category without changing Gali's one daily Jodi", () => {
  const context = {
    normalizeMarketType(value) {
      return /gali|disawar/i.test(value) ? "Gali / Disawar"
        : /starline/i.test(value) ? "Starline" : "Main market";
    },
    panelSingle(panel) {
      return /^\d{3}$/.test(String(panel || ""))
        ? String([...panel].reduce((sum, digit) => sum + Number(digit), 0) % 10) : "";
    }
  };
  vm.runInNewContext(
    `${adminResultFormatSource}\nglobalThis.marketResultForDisplay = marketResultForDisplay;`,
    context
  );
  assert.equal(
    context.marketResultForDisplay({ type: "Gali / Disawar" }, "123 - 45 - 678"),
    "45"
  );
  assert.equal(
    context.marketResultForDisplay({ type: "Gali / Disawar" }, "### - ## - ###"),
    "##"
  );
  assert.equal(
    context.marketResultForDisplay({ type: "Starline" }, "123"),
    "123 - 6"
  );
  assert.equal(
    context.marketResultForDisplay({ type: "Main market" }, "123 - 45 - 678"),
    "123 - 45 - 678"
  );
});

test("player panel chart reads a Gali daily result and its legacy Jodi", () => {
  const context = {};
  vm.runInNewContext(
    `${siteChartResultSource}\nglobalThis.panelChartResultParts = panelChartResultParts;`,
    context
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(context.panelChartResultParts({
      resultFormat: "gali",
      dailyResult: "27"
    }, "Gali / Disawar"))),
    ["27"]
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(context.panelChartResultParts("111 - 27 - 222", "Gali / Disawar"))),
    ["27"]
  );
});

test("public result chart reads the same result database and formats Gali daily entries", () => {
  const chartSource = fs.readFileSync(
    path.join(__dirname, "..", "WebPlay", "WebPlay", "web-result.html"),
    "utf8"
  );
  assert.match(chartSource, /a2morning-web-result-default-rtdb\.firebaseio\.com/);
  assert.match(chartSource, /record\.dailyResult \|\| record\.result/);
  assert.match(chartSource, /format\.includes\("gali"\)/);
});

test("Starline and Gali betting rules expose category-specific game types", () => {
  assert.match(deployedWebsiteSource, /if \(\/gali\|disawar\/i\.test\(market\?\.category\)\) return \["Jodi"\]/);
  assert.match(deployedWebsiteSource, /if \(\/starline\/i\.test\(market\?\.category\)\)/);
  assert.match(websiteSource, /if \(\/gali\|disawar\/i\.test\(market\.category\)\)/);
  assert.match(adminSource, /if \(format === "gali"\) return \[\["Jodi Digit"/);
  assert.match(adminSource, /if \(format === "starline"\) return \[/);
  assert.match(adminSource, /Starline and Gali \/ Disawar markets accept Open-session bids only/);
});

test("website market search filters cards by name and can be opened from market lists", () => {
  const searchHelper = websiteSource.match(/function marketsMatchingSearch\(markets, query\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(searchHelper, "market search filter must be present");
  const context = {};
  vm.runInNewContext(`${searchHelper}\nglobalThis.marketsMatchingSearch = marketsMatchingSearch;`, context);
  const markets = [
    { name: "Kalyan Morning" },
    { name: "Madhur Night" },
    { name: "Starline Kalyan" }
  ];
  assert.deepEqual(
    JSON.parse(JSON.stringify(context.marketsMatchingSearch(markets, "  kalyan "))).map(market => market.name),
    ["Kalyan Morning", "Starline Kalyan"]
  );
  assert.equal(context.marketsMatchingSearch(markets, "").length, 3);
  assert.match(websiteSource, /data-action="toggle-market-search"/);
  assert.match(websiteSource, /id="website-market-search" type="search" aria-label="Search markets"/);
  assert.match(websiteStylesSource, /\.website-market-search\.is-open \{ width: 100%; \}/);
  assert.match(websiteSource, /marketListSearchRow\(\)[\s\S]*marketCards\(markets, true\)/);
  assert.match(websiteSource, /marketListSearchRow\(\)[\s\S]*marketCards\(allMarkets, true\)/);
});
