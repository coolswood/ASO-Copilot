export const POSTHOG_HOSTS = {
  us: "https://us.posthog.com",
  eu: "https://eu.posthog.com",
} as const;

export interface PostHogCredentials {
  host: string;
  projectId: string;
  apiKey: string;
}

export interface PostHogVerifyResult {
  ok: boolean;
  projectName?: string;
  error?: string;
}

export interface DailyActiveUsersPoint {
  day: string; // "YYYY-MM-DD"
  dau: number;
}

/** Daily distinct-person count over the trailing `days`, via a HogQL query
 * against the raw `events` table rather than a specific named event - mobile
 * SDKs don't share a single standard "pageview"-equivalent event the way web
 * analytics does, so counting any event activity per day is the one query
 * that works regardless of what this particular app actually instruments. */
export async function fetchDailyActiveUsers(
  { host, projectId, apiKey }: PostHogCredentials,
  days = 30,
): Promise<DailyActiveUsersPoint[] | null> {
  try {
    const res = await fetch(`${host.replace(/\/$/, "")}/api/projects/${projectId}/query/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        query: {
          kind: "HogQLQuery",
          query: `
            SELECT toDate(timestamp) AS day, count(DISTINCT person_id) AS dau
            FROM events
            WHERE timestamp >= now() - INTERVAL ${days} DAY
            GROUP BY day
            ORDER BY day
          `,
        },
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { results?: [string, number][] };
    return (data.results ?? []).map(([day, dau]) => ({ day, dau }));
  } catch {
    return null;
  }
}

/** Confirms a personal API key can actually read the given project before we
 * save it - a typo'd or write-only (project) key would otherwise fail silently
 * the first time something tries to pull analytics. */
export async function verifyPostHogCredentials({
  host,
  projectId,
  apiKey,
}: PostHogCredentials): Promise<PostHogVerifyResult> {
  try {
    const res = await fetch(`${host.replace(/\/$/, "")}/api/projects/${projectId}/`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return { ok: false, error: "That API key doesn't have access to this project. Use a personal API key with read access." };
      }
      if (res.status === 404) {
        return { ok: false, error: "Project not found for that project ID." };
      }
      return { ok: false, error: `PostHog returned ${res.status}` };
    }
    const data = (await res.json()) as { name?: string };
    return { ok: true, projectName: data.name };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
