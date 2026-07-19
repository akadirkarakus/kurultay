import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Next.js auto-loads .env.local for `next dev`/`next build`, but standalone
 * scripts run via `tsx` get no such loading — this fills that gap without
 * adding a dotenv dependency.
 */
export function loadEnvLocal(): void {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key && !(key in process.env)) process.env[key] = value;
  }
}
