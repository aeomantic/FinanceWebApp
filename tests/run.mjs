import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const compile = spawnSync(process.execPath, [
  "node_modules/typescript/bin/tsc",
  "src/lib/auth/validation.ts",
  "src/lib/supabase/cache.ts",
  "src/lib/dashboard/summary.test.ts",
  "src/lib/dashboard/validation.test.ts",
  "--outDir", ".tmp/tests", "--rootDir", "src",
  "--target", "ES2017", "--module", "commonjs",
  "--esModuleInterop", "--skipLibCheck", "--strict",
], { cwd: root, stdio: "inherit" });
if (compile.status !== 0) process.exit(compile.status ?? 1);
const tests = spawnSync(process.execPath, [
  "--test", "tests/auth-validation.test.mjs",
  "tests/wallet-deletion.test.mjs",
  "tests/auth-callback.test.mjs",
  "tests/auth-server.test.mjs",
  ".tmp/tests/lib/dashboard/summary.test.js",
  ".tmp/tests/lib/dashboard/validation.test.js",
], { cwd: root, stdio: "inherit" });
process.exit(tests.status ?? 1);
