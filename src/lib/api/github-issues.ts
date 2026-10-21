import type { FeedbackArea, FeedbackPriority, FeedbackStatus, FeedbackType } from "@/lib/api/json";
import { isActiveFeedback } from "@/lib/api/json";

export type GithubIssueDraft = {
  id: string;
  title: string;
  type: FeedbackType;
  priority: FeedbackPriority;
  area: FeedbackArea;
  description: string;
  screenshotUrls: string[];
  submitterName: string;
  submitterUsername: string;
  organizationName: string | null;
  adminUrl: string;
};

export type GithubIssue = {
  number: number;
  htmlUrl: string;
};

function config() {
  const token = process.env.GITHUB_TOKEN?.trim();
  const repo = process.env.GITHUB_REPO?.trim() ?? "";
  const slash = repo.indexOf("/");
  const apiUrl = (process.env.GITHUB_API_URL?.trim() || "https://api.github.com").replace(/\/$/, "");
  if (!token || slash <= 0 || slash !== repo.lastIndexOf("/") || slash === repo.length - 1) {
    return null;
  }

  return {
    token,
    owner: repo.slice(0, slash),
    name: repo.slice(slash + 1),
    apiUrl,
  };
}

function labels(type: FeedbackType, priority: FeedbackPriority, area: FeedbackArea) {
  return [type, `priority:${priority}`, `area:${area}`];
}

function labelColor(label: string) {
  if (label === "Bug") return "d73a4a";
  if (label === "Feature") return "0e8a16";
  if (label === "priority:Urgent") return "b60205";
  if (label === "priority:High") return "d93f0b";
  if (label === "priority:Medium") return "fbca04";
  if (label === "priority:Low") return "0e8a16";
  return "cfd3d7";
}

function body(draft: GithubIssueDraft) {
  const lines = [
    `**Type:** ${draft.type}`,
    `**Priority:** ${draft.priority}`,
    `**Area:** ${draft.area === "LogTime" ? "Log time" : draft.area}`,
    `**From:** ${draft.submitterName} (\`${draft.submitterUsername}\`)`,
  ];
  if (draft.organizationName) {
    lines.push(`**Organization:** ${draft.organizationName}`);
  }

  lines.push(`**VolunTime:** ${draft.adminUrl}`, "", draft.description);
  for (const url of draft.screenshotUrls) {
    lines.push("", `![Screenshot](${url})`);
  }

  lines.push("", `VolunTime id: \`${draft.id}\``);
  return lines.join("\n");
}

async function github<T>(path: string, init: RequestInit): Promise<T | null> {
  const settings = config();
  if (!settings) {
    return null;
  }

  try {
    const response = await fetch(`${settings.apiUrl}${path}`, {
      ...init,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${settings.token}`,
        "Content-Type": "application/json",
        "User-Agent": "clocked-in",
        "X-GitHub-Api-Version": "2022-11-28",
        ...init.headers,
      },
    });
    if (!response.ok) {
      return null;
    }

    if (response.status === 204) {
      return {} as T;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function ensureLabels(names: string[]) {
  const settings = config();
  if (!settings) {
    return;
  }

  await Promise.all(
    names.map((name) =>
      github(`/repos/${settings.owner}/${settings.name}/labels`, {
        method: "POST",
        body: JSON.stringify({ name, color: labelColor(name) }),
      }),
    ),
  );
}

type GithubIssueResponse = {
  number?: number;
  html_url?: string;
};

export async function createGithubIssue(draft: GithubIssueDraft): Promise<GithubIssue | null> {
  const settings = config();
  if (!settings) {
    return null;
  }

  const issueLabels = labels(draft.type, draft.priority, draft.area);
  await ensureLabels(issueLabels);
  const payload = { title: draft.title, body: body(draft), labels: issueLabels };
  const created =
    (await github<GithubIssueResponse>(`/repos/${settings.owner}/${settings.name}/issues`, {
      method: "POST",
      body: JSON.stringify(payload),
    })) ??
    (await github<GithubIssueResponse>(`/repos/${settings.owner}/${settings.name}/issues`, {
      method: "POST",
      body: JSON.stringify({ title: draft.title, body: body(draft) }),
    }));
  if (!created?.number || !created.html_url) {
    return null;
  }

  return { number: created.number, htmlUrl: created.html_url };
}

export async function syncGithubIssueState(number: number, status: FeedbackStatus) {
  const settings = config();
  if (!settings) {
    return;
  }

  const payload: { state: "open" | "closed"; state_reason?: "completed" | "not_planned" } = {
    state: isActiveFeedback(status) ? "open" : "closed",
  };
  if (payload.state === "closed") {
    payload.state_reason = status === "Resolved" ? "completed" : "not_planned";
  }

  await github(`/repos/${settings.owner}/${settings.name}/issues/${number}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
