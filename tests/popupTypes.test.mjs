import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const popupPath = path.join(projectRoot, "src/popup.ts");

const typeChecks = `
// @ts-expect-error Reload requests require a reloaded response, not a state response.
void sendRequest({ type: messageTypes.reloadFacebookTabs });

// @ts-expect-error Reading state is not a setting update.
void applySetting({ request: { type: messageTypes.getState }, onApplied: () => {}, errorKey: "updateError" });

// @ts-expect-error Reloading tabs is not a setting update.
void applySetting({ request: { type: messageTypes.reloadFacebookTabs }, onApplied: () => {}, errorKey: "updateError" });

// @ts-expect-error This handler only changes realtime blocking.
void updateSetting({ type: messageTypes.setLanguage, language: "en" });

// @ts-expect-error This handler does not change the theme.
void updateSetting({ type: messageTypes.setTheme, theme: "dark" });

// @ts-expect-error This handler does not read state.
void updateSetting({ type: messageTypes.getState });

// @ts-expect-error Unknown icon names must not compile.
lucide.createElement(lucide.icons.NotARealIcon);

// @ts-expect-error Icon nodes must have the shape defined by Lucide.
lucide.createElement({});
`;

test("popup types reject incompatible requests and invalid icons", () => {
  const configFile = ts.readConfigFile(path.join(projectRoot, "tsconfig.json"), ts.sys.readFile);
  assert.equal(configFile.error, undefined);
  const config = ts.parseJsonConfigFileContent(configFile.config, ts.sys, projectRoot);
  const options = { ...config.options, noEmit: true };
  const host = ts.createCompilerHost(options);
  const getSourceFile = host.getSourceFile.bind(host);
  const popupSource = readFileSync(popupPath, "utf8") + typeChecks;
  host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
    if (path.resolve(fileName) === popupPath) {
      return ts.createSourceFile(fileName, popupSource, languageVersion, true);
    }
    return getSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
  };
  const program = ts.createProgram(config.fileNames, options, host);
  assert.ok(program.getSourceFile(popupPath)?.text.endsWith(typeChecks), "Type checks were not loaded");
  const diagnostics = [...config.errors, ...ts.getPreEmitDiagnostics(program)];
  const report = ts.formatDiagnostics(diagnostics, {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => projectRoot,
    getNewLine: () => "\n",
  });
  assert.equal(diagnostics.length, 0, report);
});
