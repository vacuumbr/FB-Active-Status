import { cp, mkdir, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDirectory = path.join(projectRoot, "dist");
const publicDirectory = path.join(projectRoot, "public");
const fontsDirectory = path.join(publicDirectory, "fonts");
const tscExecutable = process.execPath;
const tscArguments = [
  path.join(projectRoot, "node_modules", "typescript", "bin", "tsc"),
  "-p",
  "tsconfig.json",
];

await rm(distDirectory, { recursive: true, force: true });
await mkdir(distDirectory, { recursive: true });

const compileResult = spawnSync(tscExecutable, tscArguments, {
  cwd: projectRoot,
  stdio: "inherit",
});

if (compileResult.error) {
  throw compileResult.error;
}

if (compileResult.status !== 0) {
  process.exit(compileResult.status ?? 1);
}

const tailwindExecutable = process.execPath;
const tailwindArguments = [
  path.join(projectRoot, "node_modules", "@tailwindcss", "cli", "dist", "index.mjs"),
  "--input",
  path.join(projectRoot, "src", "popup.css"),
  "--output",
  path.join(projectRoot, "public", "popup.css"),
  "--minify",
];

const tailwindResult = spawnSync(tailwindExecutable, tailwindArguments, {
  cwd: projectRoot,
  stdio: "inherit",
});

if (tailwindResult.error) {
  throw tailwindResult.error;
}

if (tailwindResult.status !== 0) {
  process.exit(tailwindResult.status ?? 1);
}

const fontSourceDirectory = path.join(
  projectRoot,
  "node_modules",
  "@fontsource",
  "be-vietnam-pro",
  "files",
);
const fontSubsets = ["latin", "vietnamese"];
const fontWeights = [400, 500, 600, 700, 800];

await mkdir(fontsDirectory, { recursive: true });
await Promise.all(
  fontSubsets.flatMap((subset) =>
    fontWeights.map((weight) =>
      cp(
        path.join(
          fontSourceDirectory,
          `be-vietnam-pro-${subset}-${weight}-normal.woff2`,
        ),
        path.join(
          fontsDirectory,
          `be-vietnam-pro-${subset}-${weight}-normal.woff2`,
        ),
      ),
    ),
  ),
);
console.log(
  `Đã copy ${fontSubsets.length * fontWeights.length} font từ @fontsource/be-vietnam-pro.`,
);

await cp(publicDirectory, distDirectory, { recursive: true });
const lucideSource = path.join(
  projectRoot,
  "node_modules",
  "lucide",
  "dist",
  "umd",
  "lucide.min.js",
);
await cp(lucideSource, path.join(distDirectory, "lucide.min.js"));
console.log(`Extension đã được build tại: ${distDirectory}`);
