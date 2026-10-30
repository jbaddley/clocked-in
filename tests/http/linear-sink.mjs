import { randomUUID } from "node:crypto";
import { createServer } from "node:http";

const issues = [];
const labels = [
  { id: "label-bug", name: "Bug" },
  { id: "label-feature", name: "Feature" },
];
const states = [
  { id: "state-triage", name: "Triage", type: "triage" },
  { id: "state-backlog", name: "Backlog", type: "backlog" },
  { id: "state-todo", name: "Todo", type: "unstarted" },
  { id: "state-in-progress", name: "In Progress", type: "started" },
  { id: "state-done", name: "Done", type: "completed" },
  { id: "state-canceled", name: "Canceled", type: "canceled" },
  { id: "state-could-not-reproduce", name: "Could not reproduce", type: "canceled" },
  { id: "state-archived", name: "Archived", type: "canceled" },
];
const team = {
  id: "team-voluntime",
  key: "VOL",
  name: "VolunTime",
};
const port = Number(process.env.LINEAR_SINK_PORT || 5400);
let nextNumber = 1;

function send(response, status, body) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");

  if (request.method === "POST" && (url.pathname === "/graphql" || url.pathname === "/")) {
    const body = await readJson(request);
    const query = String(body.query ?? "");
    const variables = body.variables ?? {};

    if (query.includes("issueLabelCreate")) {
      const input = variables.input ?? {};
      const name = String(input.name ?? "label");
      let label = labels.find((item) => item.name.toLowerCase() === name.toLowerCase());
      if (!label) {
        label = { id: `label-${labels.length + 1}`, name };
        labels.push(label);
      }
      send(response, 200, {
        data: {
          issueLabelCreate: {
            success: true,
            issueLabel: label,
          },
        },
      });
      return;
    }

    if (query.includes("issueCreate")) {
      const input = variables.input ?? {};
      const number = nextNumber;
      nextNumber += 1;
      const id = randomUUID();
      const identifier = `${team.key}-${number}`;
      const state = states.find((item) => item.id === input.stateId) ?? states[0];
      const attachedLabels = (input.labelIds ?? [])
        .map((labelId) => labels.find((item) => item.id === labelId)?.name)
        .filter(Boolean);
      const issue = {
        id,
        number,
        identifier,
        title: input.title,
        description: input.description,
        priority: input.priority ?? 0,
        labels: attachedLabels,
        stateId: state.id,
        stateName: state.name,
        stateType: state.type,
        url: `https://linear.app/voluntime/issue/${identifier}`,
      };
      issues.push(issue);
      send(response, 200, {
        data: {
          issueCreate: {
            success: true,
            issue: {
              id: issue.id,
              identifier: issue.identifier,
              url: issue.url,
            },
          },
        },
      });
      return;
    }

    if (query.includes("issueUpdate")) {
      const id = variables.id;
      const input = variables.input ?? {};
      const issue = issues.find((item) => item.id === id);
      if (!issue) {
        send(response, 200, { errors: [{ message: "Issue not found" }] });
        return;
      }

      if (input.stateId) {
        const state = states.find((item) => item.id === input.stateId);
        if (state) {
          issue.stateId = state.id;
          issue.stateName = state.name;
          issue.stateType = state.type;
        }
      }
      send(response, 200, {
        data: {
          issueUpdate: {
            success: true,
          },
        },
      });
      return;
    }

    if (query.includes("FeedbackIssueStates") || query.includes("issue(id:")) {
      send(response, 200, {
        data: {
          issue: {
            id: variables.id,
            team: {
              states: {
                nodes: states,
              },
            },
          },
        },
      });
      return;
    }

    if (query.includes("teams")) {
      send(response, 200, {
        data: {
          teams: {
            nodes: [
              {
                ...team,
                states: { nodes: states },
                labels: { nodes: labels },
              },
            ],
          },
        },
      });
      return;
    }

    send(response, 400, { errors: [{ message: "Unsupported GraphQL operation" }] });
    return;
  }

  if (request.method === "GET" && url.pathname === "/issues") {
    send(response, 200, issues);
    return;
  }

  response.writeHead(404);
  response.end();
});

server.listen(port, "127.0.0.1", () => {
  console.log(`linear sink listening on http://127.0.0.1:${port}`);
});
