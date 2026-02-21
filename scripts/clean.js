/**
 * Clean all Next.js and Turbopack caches for reliable dev server startup.
 * Retry loop handles OneDrive/Windows file locks.
 */
const fs = require("fs");
const path = require("path");

const DIRS = [".next", "node_modules/.cache", ".turbo"];
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 500;

function sleep(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {}
}

function rmWithRetry(dir) {
  const full = path.join(process.cwd(), dir);
  if (!fs.existsSync(full)) {
    console.log(`[clean] ${dir}: not present, skip`);
    return true;
  }
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      fs.rmSync(full, { recursive: true, force: true });
      console.log(`[clean] ${dir}: removed`);
      return true;
    } catch (err) {
      console.error(`[clean] ${dir}: attempt ${attempt}/${MAX_ATTEMPTS} FAILED - ${err.message}`);
      if (attempt < MAX_ATTEMPTS) {
        sleep(RETRY_DELAY_MS);
      }
    }
  }
  return false;
}

let allOk = true;
for (const dir of DIRS) {
  if (!rmWithRetry(dir)) allOk = false;
}

if (allOk) {
  console.log("[clean] success");
  process.exit(0);
} else {
  console.log("[clean] some deletions failed");
  process.exit(1);
}
