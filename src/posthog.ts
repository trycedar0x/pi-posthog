export type PostHogConfig = {
  host: string;
  personalApiKey: string;
  projectId?: string;
  maxBytes: number;
};

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

type RequestOptions = {
  method?: "GET" | "POST";
  body?: JsonValue;
  signal?: AbortSignal;
};

const DEFAULT_HOST = "https://us.posthog.com";
const DEFAULT_MAX_BYTES = 40_000;

export function readConfig(): PostHogConfig {
  return {
    host: normalizeHost(process.env.POSTHOG_HOST ?? process.env.POSTHOG_API_HOST ?? DEFAULT_HOST),
    personalApiKey: process.env.POSTHOG_PERSONAL_API_KEY ?? process.env.POSTHOG_API_KEY ?? "",
    projectId: process.env.POSTHOG_PROJECT_ID,
    maxBytes: parseInteger(process.env.POSTHOG_MAX_RESPONSE_BYTES, DEFAULT_MAX_BYTES),
  };
}

function parseInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeHost(host: string): string {
  return host.replace(/\/+$/, "");
}

export function requireApiKey(config: PostHogConfig): void {
  if (!config.personalApiKey) {
    throw new Error(
      "Missing PostHog API key. Set POSTHOG_PERSONAL_API_KEY to a PostHog personal API key with read access."
    );
  }
}

export function requireProjectId(config: PostHogConfig, explicitProjectId?: string): string {
  const projectId = explicitProjectId ?? config.projectId;
  if (!projectId) {
    throw new Error("Missing PostHog project ID. Set POSTHOG_PROJECT_ID or pass projectId to the tool.");
  }
  return projectId;
}

export function truncateJson(value: unknown, maxBytes: number): { text: string; truncated: boolean } {
  const text = JSON.stringify(value, null, 2);
  if (Buffer.byteLength(text, "utf8") <= maxBytes) return { text, truncated: false };
  let bytes = 0;
  let end = 0;
  for (const char of text) {
    const size = Buffer.byteLength(char, "utf8");
    if (bytes + size > maxBytes) break;
    bytes += size;
    end += char.length;
  }
  return {
    text: `${text.slice(0, end)}\n\n[truncated to ${maxBytes} bytes]`,
    truncated: true,
  };
}

export class PostHogClient {
  constructor(private readonly config: PostHogConfig) {}

  async request(path: string, options: RequestOptions = {}): Promise<unknown> {
    requireApiKey(this.config);
    if (!path.startsWith("/api/")) {
      throw new Error("Only PostHog API paths beginning with /api/ are allowed.");
    }

    const response = await fetch(`${this.config.host}${path}`, {
      method: options.method ?? "GET",
      headers: {
        Authorization: `Bearer ${this.config.personalApiKey}`,
        "Content-Type": "application/json",
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });

    const contentType = response.headers.get("content-type") ?? "";
    const payload = contentType.includes("application/json") ? await response.json() : await response.text();

    if (!response.ok) {
      const message = typeof payload === "string" ? payload : JSON.stringify(payload);
      throw new Error(`PostHog API ${response.status} ${response.statusText}: ${message}`);
    }

    return payload;
  }

  queryHogQL(query: string, projectId?: string, signal?: AbortSignal): Promise<unknown> {
    const resolvedProjectId = requireProjectId(this.config, projectId);
    return this.request(`/api/projects/${encodeURIComponent(resolvedProjectId)}/query/`, {
      method: "POST",
      signal,
      body: {
        query: {
          kind: "HogQLQuery",
          query,
        },
      },
    });
  }

  listResource(resource: string, projectId?: string, signal?: AbortSignal): Promise<unknown> {
    const resolvedProjectId = requireProjectId(this.config, projectId);
    const endpoints: Record<string, string> = {
      dashboards: "dashboards",
      insights: "insights",
      feature_flags: "feature_flags",
      experiments: "experiments",
      annotations: "annotations",
      cohorts: "cohorts",
      persons: "persons",
    };
    const endpoint = endpoints[resource];
    if (!endpoint) throw new Error(`Unsupported resource: ${resource}`);
    return this.request(`/api/projects/${encodeURIComponent(resolvedProjectId)}/${endpoint}/`, { signal });
  }

  listProjects(signal?: AbortSignal): Promise<unknown> {
    return this.request("/api/projects/", { signal });
  }
}
