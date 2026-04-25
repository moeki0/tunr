import { join } from "path";
import { homedir } from "os";

const CACHE_PATH = join(homedir(), ".tunr", "update-check.json");
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h

interface CacheData {
  latestVersion: string;
  checkedAt: number;
}

function parseVersion(v: string): number[] {
  return v.replace(/^v/, "").split(".").map(Number);
}

function isNewer(latest: string, current: string): boolean {
  const l = parseVersion(latest);
  const c = parseVersion(current);
  for (let i = 0; i < 3; i++) {
    if ((l[i] ?? 0) > (c[i] ?? 0)) return true;
    if ((l[i] ?? 0) < (c[i] ?? 0)) return false;
  }
  return false;
}

export async function checkForUpdate(currentVersion: string): Promise<string | null> {
  try {
    // Check cache first
    const cacheFile = Bun.file(CACHE_PATH);
    if (await cacheFile.exists()) {
      const cache: CacheData = await cacheFile.json();
      if (Date.now() - cache.checkedAt < CHECK_INTERVAL_MS) {
        return isNewer(cache.latestVersion, currentVersion) ? cache.latestVersion : null;
      }
    }

    // Fetch latest release from GitHub
    const res = await fetch("https://api.github.com/repos/moeki0/tunr/releases/latest", {
      headers: { "Accept": "application/vnd.github.v3+json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;

    const data = await res.json() as { tag_name: string };
    const latestVersion = data.tag_name.replace(/^v/, "");

    // Cache result
    await Bun.write(CACHE_PATH, JSON.stringify({ latestVersion, checkedAt: Date.now() } satisfies CacheData));

    return isNewer(latestVersion, currentVersion) ? latestVersion : null;
  } catch {
    return null;
  }
}
