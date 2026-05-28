import { afterEach, describe, expect, it, vi } from "vitest";
import { PostHogClient, readConfig, requireProjectId, truncateJson } from "../src/posthog.js";

describe("configuration", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("reads host, API key, and project ID from environment", () => {
    process.env.POSTHOG_HOST = "https://eu.posthog.com/";
    process.env.POSTHOG_PERSONAL_API_KEY = "phx_test";
    process.env.POSTHOG_PROJECT_ID = "123";

    expect(readConfig()).toMatchObject({
      host: "https://eu.posthog.com",
      personalApiKey: "phx_test",
      projectId: "123",
    });
  });

  it("requires project ID from config or params", () => {
    expect(requireProjectId({ host: "https://us.posthog.com", personalApiKey: "x", maxBytes: 100 }, "456")).toBe(
      "456"
    );
    expect(() => requireProjectId({ host: "https://us.posthog.com", personalApiKey: "x", maxBytes: 100 })).toThrow(
      /project ID/
    );
  });
});

describe("PostHogClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends HogQL queries to the project query endpoint", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ results: [[42]] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new PostHogClient({
      host: "https://us.posthog.com",
      personalApiKey: "phx_test",
      projectId: "123",
      maxBytes: 1000,
    });

    await expect(client.queryHogQL("SELECT 1")).resolves.toEqual({ results: [[42]] });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://us.posthog.com/api/projects/123/query/",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer phx_test" }),
        body: JSON.stringify({ query: { kind: "HogQLQuery", query: "SELECT 1" } }),
      })
    );
  });

  it("rejects non-API paths", async () => {
    const client = new PostHogClient({ host: "https://us.posthog.com", personalApiKey: "x", maxBytes: 1000 });
    await expect(client.request("/login")).rejects.toThrow(/beginning with \/api\//);
  });
});

describe("truncateJson", () => {
  it("truncates oversized JSON", () => {
    const result = truncateJson({ text: "x".repeat(100) }, 20);
    expect(result.truncated).toBe(true);
    expect(result.text).toContain("truncated");
  });
});
