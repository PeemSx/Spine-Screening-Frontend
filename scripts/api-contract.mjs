import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const input = join(projectRoot, "contracts", "spine-screening-api.openapi.json");
const output = join(
  projectRoot,
  "features",
  "screening",
  "api",
  "schema.generated.ts",
);
const check = process.argv.includes("--check");
const temporaryDirectory = check
  ? mkdtempSync(join(tmpdir(), "spine-api-contract-"))
  : null;
const destination = temporaryDirectory
  ? join(temporaryDirectory, "schema.generated.ts")
  : output;
const executable = join(
  projectRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "openapi-typescript.cmd" : "openapi-typescript",
);

if (!existsSync(input)) {
  console.error(`Missing API contract snapshot: ${input}`);
  console.error("Run from the workspace root: make export-contract");
  process.exit(1);
}

const result = spawnSync(executable, [input, "--output", destination], {
  cwd: projectRoot,
  encoding: "utf8",
  stdio: "pipe",
});

if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout);
  if (temporaryDirectory) rmSync(temporaryDirectory, { recursive: true, force: true });
  process.exit(result.status ?? 1);
}

if (check) {
  const current = existsSync(output) ? readFileSync(output) : null;
  const expected = readFileSync(destination);
  rmSync(temporaryDirectory, { recursive: true, force: true });
  if (current === null || !current.equals(expected)) {
    console.error("Generated API schema is stale.");
    console.error("Run from the workspace root: make export-contract");
    process.exit(1);
  }
  console.log("Generated API schema is current.");
} else {
  process.stdout.write(result.stdout);
}
