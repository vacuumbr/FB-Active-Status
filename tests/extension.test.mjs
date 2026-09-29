import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));

test("extension message boundaries", async (t) => {
  const outputDirectory = await mkdtemp(path.join(tmpdir(), "fb-active-status-test-"));
  t.after(() => rm(outputDirectory, { recursive: true, force: true }));
  const compileResult = spawnSync(process.execPath, [
    path.join(projectRoot, "node_modules/typescript/bin/tsc"),
    "-p", path.join(projectRoot, "tsconfig.json"),
    "--outDir", outputDirectory,
  ], { encoding: "utf8" });
  assert.equal(compileResult.status, 0, compileResult.stdout + compileResult.stderr);
  await writeFile(path.join(outputDirectory, "package.json"), '{"type":"module"}');

  const { parseExtensionResponse } = await import(
    pathToFileURL(path.join(outputDirectory, "shared.js")).href
  );
  let messageListener;
  let tabs = [];
  let failedTabIds = new Set();
  let enabledRulesetIds = ["facebook_realtime"];
  let preferences = { language: "vi", theme: "system" };
  const reloadAttempts = [];
  const diagnostics = [];
  const chromeApi = {
    runtime: {
      onMessage: { addListener: (listener) => { messageListener = listener; } },
      onInstalled: { addListener() {} },
      onStartup: { addListener() {} },
    },
    storage: { local: {
      get: async () => preferences,
      set: async (values) => { preferences = { ...preferences, ...values }; },
    } },
    declarativeNetRequest: {
      getEnabledRulesets: async () => enabledRulesetIds,
      updateEnabledRulesets: async ({ enableRulesetIds }) => {
        enabledRulesetIds = enableRulesetIds;
      },
    },
    tabs: {
      query: async () => tabs,
      reload: async (tabId) => {
        reloadAttempts.push(tabId);
        if (failedTabIds.has(tabId)) throw new Error("Tab closed");
      },
    },
    action: {
      setBadgeText: async () => {},
      setBadgeBackgroundColor: async () => {},
      setTitle: async () => {},
    },
  };
  globalThis.chrome = chromeApi;
  t.after(() => { delete globalThis.chrome; });
  t.mock.method(console, "error", (message) => diagnostics.push(JSON.parse(message)));
  await import(pathToFileURL(path.join(outputDirectory, "background.js")).href);
  await new Promise((resolve) => setImmediate(resolve));

  function sendRequest(request) {
    return new Promise((resolve) => {
      assert.equal(messageListener(request, {}, resolve), true);
    });
  }

  await t.test("reload reports successes and failures", async () => {
    for (const [tabIds, failures, expectedCounts] of [
      [[], [], [0, 0]],
      [[1, 2], [], [2, 0]],
      [[1, 2], [2], [1, 1]],
      [[1, 2], [1, 2], [0, 2]],
    ]) {
      tabs = [...tabIds.map((id) => ({ id })), {}];
      failedTabIds = new Set(failures);
      reloadAttempts.length = 0;
      const response = await sendRequest({ type: "reloadFacebookTabs" });
      assert.equal(response.type, "reloaded");
      assert.deepEqual([response.reloadedTabCount, response.failedTabCount], expectedCounts);
      assert.deepEqual(reloadAttempts, tabIds);
      assert.deepEqual(parseExtensionResponse(response), response);
    }
  });

  await t.test("response parser rejects invalid counts", () => {
    const state = { realtimeBlockingEnabled: true, language: "vi", theme: "system" };
    for (const key of ["reloadedTabCount", "failedTabCount"]) {
      for (const value of [undefined, "1", -1, 0.5, NaN, Infinity, 2 ** 53]) {
        assert.equal(parseExtensionResponse({
          type: "reloaded", state, reloadedTabCount: 0, failedTabCount: 0, [key]: value,
        }), undefined);
      }
    }
  });

  await t.test("badge failures do not turn successful operations into errors", async (t) => {
    for (const method of ["setBadgeText", "setBadgeBackgroundColor", "setTitle"]) {
      const badgeMock = t.mock.method(chromeApi.action, method, async () => {
        throw new Error("Badge unavailable");
      });
      for (const request of [
        { type: "getState" },
        { type: "setLanguage", language: "en" },
        { type: "setTheme", theme: "dark" },
        { type: "setRealtimeBlocking", enabled: false },
        { type: "reloadFacebookTabs" },
      ]) {
        const response = await sendRequest(request);
        assert.equal(response.type, request.type === "reloadFacebookTabs" ? "reloaded" : "state");
        assert.equal(diagnostics.at(-1).event, "badgeUpdateFailed");
        assert.ok(parseExtensionResponse(response));
      }
      badgeMock.mock.restore();
    }
    assert.deepEqual(preferences, { language: "en", theme: "dark" });
    assert.deepEqual(enabledRulesetIds, []);
  });

  await t.test("storage and tab-query errors still reach the popup", async (t) => {
    t.mock.method(chromeApi.storage.local, "set", async () => {
      throw new Error("Storage unavailable");
    });
    t.mock.method(chromeApi.tabs, "query", async () => {
      throw new Error("Tabs unavailable");
    });
    assert.deepEqual(await sendRequest({ type: "setLanguage", language: "vi" }), {
      type: "error", error: "Storage unavailable",
    });
    assert.deepEqual(await sendRequest({ type: "reloadFacebookTabs" }), {
      type: "error", error: "Tabs unavailable",
    });
  });
});
