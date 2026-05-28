import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { StringEnum } from "@earendil-works/pi-ai";
import { Type, type Static } from "typebox";
import { PostHogClient, readConfig, truncateJson } from "./posthog.js";

const optionalProjectId = Type.Optional(
  Type.String({ description: "PostHog project ID. Defaults to POSTHOG_PROJECT_ID." })
);

const queryParams = Type.Object({
  query: Type.String({ description: "HogQL SQL query to execute against the PostHog project." }),
  projectId: optionalProjectId,
});

type QueryParams = Static<typeof queryParams>;

const listParams = Type.Object({
  resource: StringEnum([
    "projects",
    "dashboards",
    "insights",
    "feature_flags",
    "experiments",
    "annotations",
    "cohorts",
    "persons",
  ] as const),
  projectId: optionalProjectId,
});

type ListParams = Static<typeof listParams>;

const apiGetParams = Type.Object({
  path: Type.String({
    description:
      "Read-only PostHog API path beginning with /api/. Example: /api/projects/123/insights/?limit=10",
  }),
});

type ApiGetParams = Static<typeof apiGetParams>;

function formatResult(value: unknown): { text: string; truncated: boolean } {
  const config = readConfig();
  return truncateJson(value, config.maxBytes);
}

function resultContent(prefix: string, value: unknown) {
  const formatted = formatResult(value);
  return {
    content: [
      {
        type: "text" as const,
        text: `${prefix}\n\n${formatted.text}`,
      },
    ],
    details: { result: value, truncated: formatted.truncated },
  };
}

export default function posthogExtension(pi: ExtensionAPI) {
  pi.registerTool({
    name: "posthog_query_hogql",
    label: "PostHog HogQL",
    description: "Run a read-only HogQL query against PostHog using POSTHOG_PERSONAL_API_KEY.",
    promptSnippet: "Run HogQL queries against the configured PostHog project",
    promptGuidelines: [
      "Use posthog_query_hogql when the user asks product analytics questions that can be answered with HogQL.",
      "Before using posthog_query_hogql, prefer read-only SELECT queries and include sensible LIMIT clauses.",
    ],
    parameters: queryParams,
    async execute(_toolCallId, params: QueryParams, signal) {
      const client = new PostHogClient(readConfig());
      const data = await client.queryHogQL(params.query, params.projectId, signal);
      return resultContent("PostHog HogQL result:", data);
    },
  });

  pi.registerTool({
    name: "posthog_list",
    label: "PostHog List",
    description: "List common PostHog resources: projects, dashboards, insights, feature flags, experiments, annotations, cohorts, or persons.",
    promptSnippet: "List projects and common PostHog project resources",
    promptGuidelines: [
      "Use posthog_list before calling specific PostHog API paths when the user asks what exists in PostHog.",
    ],
    parameters: listParams,
    async execute(_toolCallId, params: ListParams, signal) {
      const client = new PostHogClient(readConfig());
      const data =
        params.resource === "projects"
          ? await client.listProjects(signal)
          : await client.listResource(params.resource, params.projectId, signal);
      return resultContent(`PostHog ${params.resource} result:`, data);
    },
  });

  pi.registerTool({
    name: "posthog_api_get",
    label: "PostHog API GET",
    description: "Call a read-only PostHog API GET path. The path must begin with /api/.",
    promptSnippet: "Fetch a read-only PostHog API path",
    promptGuidelines: [
      "Use posthog_api_get for read-only PostHog endpoints not covered by posthog_list or posthog_query_hogql.",
      "Do not use posthog_api_get for mutating PostHog API calls; it only supports GET requests.",
    ],
    parameters: apiGetParams,
    async execute(_toolCallId, params: ApiGetParams, signal) {
      const client = new PostHogClient(readConfig());
      const data = await client.request(params.path, { signal });
      return resultContent(`PostHog GET ${params.path} result:`, data);
    },
  });

  pi.registerCommand("posthog-status", {
    description: "Show PostHog extension configuration status without revealing secrets",
    handler: async (_args, ctx) => {
      const config = readConfig();
      const status = [
        `host=${config.host}`,
        `personalApiKey=${config.personalApiKey ? "set" : "missing"}`,
        `projectId=${config.projectId ?? "missing"}`,
      ].join(" ");
      ctx.ui.notify(`PostHog: ${status}`, config.personalApiKey ? "info" : "warning");
    },
  });
}
